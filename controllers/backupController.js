const mysqldump = require("mysqldump");
const path = require("path");
const fs = require("fs");

// SQL Database Backup (On-Demand)
const exportDatabase = async (req, res) => {
  try {
    // Timestamp ke sath filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(__dirname, `../backups/bod2_${timestamp}.sql`);

    // Backup folder create karo agar nahi hai
    const backupDir = path.join(__dirname, "../backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Database dump
    await mysqldump({
      connection: {
        host: "localhost",
        user: "root",
        password: "",
        database: "bod2",
      },
      dumpToFile: backupFile,
    });

    // File download karo
    res.download(backupFile, `bod2_${timestamp}.sql`, (err) => {
      if (err) {
        console.error("Download error:", err);
      }
      // Download ke baad file delete kar do (space bachane ke liye)
      setTimeout(() => {
        fs.unlink(backupFile, (err) => {
          if (err) console.error("File delete error:", err);
          else console.log("Backup file deleted:", backupFile);
        });
      }, 1000);
    });
  } catch (error) {
    console.error("Backup error:", error);
    res.status(500).json({ error: "Backup failed", details: error.message });
  }
};

module.exports = { exportDatabase };
