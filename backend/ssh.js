const { Client } = require('ssh2');

/**
 * Exécute une commande SSH sur un équipement réseau.
 * Retourne le contenu brut de la sortie (stdout + stderr combinés).
 */
function sshExec({ host, port = 22, username, password, privateKey, command, timeout = 45000 }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      reject(new Error(`Timeout SSH après ${timeout / 1000}s (${host}:${port})`));
    }, timeout);

    conn.on('ready', () => {
      conn.shell({ term: 'vt100', cols: 250, rows: 9999 }, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          return reject(new Error(`Shell SSH: ${err.message}`));
        }

        let settled = false;
        let noDataTimer = null;
        let commandSent = false;

        function finish() {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearTimeout(noDataTimer);
          conn.end();
          resolve(cleanOutput(output));
        }

        // Timeout d'inactivité : 8s après dernier chunk de données (config complète souvent longue)
        function resetNoDataTimer(ms = 8000) {
          clearTimeout(noDataTimer);
          noDataTimer = setTimeout(finish, ms);
        }

        stream.on('data', (data) => {
          const chunk = data.toString('utf8');
          output += chunk;

          // Intercepter les pauses --More-- / --more-- / <--- More --->
          if (/--[Mm]ore--|<---\s*[Mm]ore\s*--->|\s---\s*more\s*---/i.test(chunk)) {
            stream.write(' '); // envoyer espace pour continuer
            resetNoDataTimer(10000);
            return;
          }

          // Détection de fin : prompt après la commande
          if (commandSent) {
            // Si on voit un prompt réseau après la sortie de show run → terminé
            const last200 = output.slice(-200);
            if (/[\w\-\.]+[#>]\s*$/.test(last200)) {
              // Délai court pour capturer d'éventuels derniers bytes
              clearTimeout(noDataTimer);
              noDataTimer = setTimeout(finish, 500);
              return;
            }
          }
          resetNoDataTimer(8000);
        });

        stream.stderr.on('data', (data) => {
          output += data.toString('utf8');
        });

        stream.on('close', finish);

        // Séquence d'initialisation :
        // 1. Attendre le prompt initial
        // 2. Désactiver pagination (Cisco, HP Comware, Aruba, Juniper)
        // 3. Envoyer la commande
        setTimeout(() => {
          // Cisco IOS / IOS-XE / IOS-XR
          stream.write('terminal length 0\n');
          stream.write('terminal width 0\n');
          // HP Comware / H3C
          stream.write('screen-length disable\n');
          // Aruba OS
          stream.write('no paging\n');
          // Fortinet / FortiOS
          stream.write('config system console\nset output standard\nend\n');
          setTimeout(() => {
            commandSent = true;
            stream.write(command + '\n');
            resetNoDataTimer(12000); // 12s pour la première réponse
          }, 2000); // augmenter à 2s pour laisser le temps aux commandes d'être traitées
        }, 2000); // augmenter à 2s pour le prompt initial
      });
    });

    conn.on('error', (err) => {
      if (timedOut) return;
      clearTimeout(timer);
      reject(new Error(`Connexion SSH échouée (${host}:${port}): ${err.message}`));
    });

    const connectOpts = {
      host,
      port: parseInt(port, 10),
      username,
      readyTimeout: timeout,
      hostVerifier: () => true,
      algorithms: {
        kex: [
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'curve25519-sha256',
          'curve25519-sha256@libssh.org',
        ],
        cipher: [
          'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
          'aes128-gcm', 'aes256-gcm',
          '3des-cbc', 'aes128-cbc',
        ],
        serverHostKey: [
          'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256',
          'ssh-ed25519', 'rsa-sha2-256', 'rsa-sha2-512',
        ],
      },
    };

    if (privateKey) {
      connectOpts.privateKey = privateKey;
      if (password) connectOpts.passphrase = password;
    } else if (password) {
      connectOpts.password = password;
      connectOpts.tryKeyboard = true;
    }

    conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
      const responses = prompts.map(() => password || '');
      finish(responses);
    });

    conn.connect(connectOpts);
  });
}

/**
 * Nettoie la sortie brute d'un shell SSH :
 * - Supprime les séquences ANSI/VT100
 * - Supprime les caractères de contrôle
 * - Retire les lignes de prompt
 * - Supprime les lignes d'écho des commandes envoyées
 */
function cleanOutput(raw) {
  let out = raw;

  // ── 1. Séquences ANSI/VT100 complètes (avec ESC) ─────────────────────────
  out = out.replace(/\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]/g, '');
  out = out.replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '');
  out = out.replace(/\x1B[^\[\]]/g, '');
  out = out.replace(/\x1B/g, '');

  // ── 2. Résidus CSI sans ESC (ex: [1;232r  [?25h  [?25l) ──────────────────
  out = out.replace(/\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]/g, '');

  // ── 3. Caractères de contrôle (hors \n \r) + 8-bit C1 ────────────────────
  out = out.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // ── 4. CR/LF normalisation ────────────────────────────────────────────────
  out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── 5. Filtrage ligne par ligne ───────────────────────────────────────────
  const lines = out.split('\n');
  const filtered = lines.filter(line => {
    const t = line.trim();
    if (t === '') return true;
    if (/^[\w\-\.]+((\([^)]*\))?[#>]\s*$)/.test(t)) return false;
    if (/^terminal\s+(length|width)\s+\d+\s*$/.test(t)) return false;
    if (/^screen-length\s+(disable|\d+)\s*$/.test(t)) return false;
    if (/^no\s+paging\s*$/.test(t)) return false;
    if (/^config\s+system\s+console\s*$/.test(t)) return false;
    if (/^set\s+output\s+standard\s*$/.test(t)) return false;
    if (/^end\s*$/.test(t)) return false;
    if (/^[^\n]*[#>]\s*(terminal|screen-length|no\s+paging|exit|logout|config\s+system)/.test(t)) return false;
    if (/--[Mm]ore--|<---\s*[Mm]ore\s*--->/.test(t)) return false;
    return true;
  });

  return filtered.join('\n').trim();
}

module.exports = { sshExec };
