const { Client } = require('ssh2');

/**
 * Exécute une commande SSH sur un équipement réseau.
 * Retourne le contenu brut de la sortie (stdout + stderr combinés).
 *
 * @param {object} opts
 * @param {string} opts.host       - IP ou hostname
 * @param {number} opts.port       - Port SSH (défaut 22)
 * @param {string} opts.username   - Utilisateur SSH
 * @param {string} opts.password   - Mot de passe SSH (optionnel si key fournie)
 * @param {string} opts.privateKey - Clé privée SSH PEM (optionnel)
 * @param {string} opts.command    - Commande à exécuter (ex: "show running-config")
 * @param {number} opts.timeout    - Timeout en ms (défaut 30000)
 * @returns {Promise<string>}
 */
function sshExec({ host, port = 22, username, password, privateKey, command, timeout = 30000 }) {
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
      // Pour les switchs Cisco/HP/Juniper, on ouvre un shell interactif
      // plutôt qu'exec, afin d'éviter les problèmes de pseudo-TTY
      conn.shell({ term: 'vt100', cols: 220, rows: 50 }, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          return reject(new Error(`Shell SSH: ${err.message}`));
        }

        let settled = false;
        let noDataTimer = null;

        function finish() {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearTimeout(noDataTimer);
          conn.end();
          resolve(cleanOutput(output));
        }

        // Timeout d'inactivité : si plus de données pendant 5s après la commande → on coupe
        function resetNoDataTimer() {
          clearTimeout(noDataTimer);
          noDataTimer = setTimeout(finish, 5000);
        }

        stream.on('data', (data) => {
          output += data.toString('utf8');
          resetNoDataTimer();
        });

        stream.stderr.on('data', (data) => {
          output += data.toString('utf8');
        });

        stream.on('close', finish);

        // Attendre le prompt initial puis envoyer la commande
        setTimeout(() => {
          // Désactiver la pagination (commun sur Cisco/HP/Aruba)
          stream.write('terminal length 0\n');
          setTimeout(() => {
            stream.write(command + '\n');
            resetNoDataTimer();
          }, 800);
        }, 1200);
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
      // Accepter tous les hostkeys (pas de vérification stricte en contexte réseau interne)
      hostVerifier: () => true,
      algorithms: {
        kex: [
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
        ],
        cipher: [
          'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
          'aes128-gcm', 'aes256-gcm',
          '3des-cbc', 'aes128-cbc',
        ],
        serverHostKey: [
          'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256',
          'ssh-ed25519',
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

    // Gestion clavier-interactif (enable password sur certains équipements)
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
 * - Retire les lignes de prompt (ex: Switch#, Router>, hostname#)
 * - Trim global
 */
function cleanOutput(raw) {
  // Séquences ANSI (couleurs, déplacement curseur, etc.)
  let out = raw.replace(/\x1B\[[0-9;]*[mGKHFJABCDSTu]/g, '');
  // Caractères de contrôle sauf \n et \r
  out = out.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  // Retours chariot Windows
  out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Supprimer les lignes qui ressemblent à des prompts (finissent par # ou >)
  const lines = out.split('\n');
  const filtered = lines.filter(line => {
    const t = line.trim();
    // Garder les lignes vides (structure du fichier config)
    if (t === '') return true;
    // Supprimer les prompts typiques de switchs
    if (/^[\w\-\.]+[#>]\s*$/.test(t)) return false;
    if (/^[\w\-\.]+[#>]\s*(terminal|exit|logout|show)/.test(t)) return false;
    return true;
  });
  return filtered.join('\n').trim();
}

module.exports = { sshExec };
