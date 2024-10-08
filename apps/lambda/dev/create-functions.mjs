import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const parentDir = path.resolve(currentDir, "..");

// Read all .js and .mjs files in the current directory
try {
  const files = await fs.readdir(parentDir);
  console.log(files);
  for (const file of files) {
    if (
      (file.endsWith(".js") || file.endsWith(".mjs")) &&
      file !== "create-functions.js"
    ) {
      const functionName = path.basename(file, path.extname(file));
      const handler = `${functionName}.handler`;

      const command = `awslocal lambda create-function \
        --function-name ${functionName} \
        --runtime "nodejs20.x" \
        --role arn:aws:iam::123456789012:role/lambda-ex \
        --code S3Bucket="hot-reload",S3Key="${parentDir}" \
        --handler ${handler} \
        --timeout 120`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error creating function ${functionName}:`, error);
          return;
        }
        console.log(`Function ${functionName} created successfully`);
        // console.log(stdout);
      });
    }
  }
} catch (err) {
  console.error("Error reading directory:", err);
}
