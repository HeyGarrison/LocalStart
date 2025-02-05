import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const parentDir = path.resolve(currentDir, "..");
const distDir = path.resolve(parentDir, "dist");

// Read and parse .env file
async function loadEnvVars() {
  try {
    const envPath = path.resolve(parentDir, '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    });
    
    return envVars;
  } catch (err) {
    console.error('Error loading .env file:', err);
    return {};
  }
}

// Format environment variables for AWS CLI
function formatEnvironmentVariables(envVars) {
  const vars = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  return `Variables={${vars}}`;
}

// Read all .js files in the dist directory
try {
  const envVars = await loadEnvVars();
  const envVarsFormatted = formatEnvironmentVariables(envVars);

  const files = await fs.readdir(distDir);
  for (const file of files) {
    if (file.endsWith(".js")) {
      // Remove .js extension for function name
      const functionName = path.basename(file, '.js');
      // Use .js extension for handler
      const handler = `${functionName}.handler`;

      const command = `awslocal lambda create-function \
        --function-name ${functionName} \
        --runtime "nodejs20.x" \
        --role arn:aws:iam::123456789012:role/lambda-ex \
        --code S3Bucket="hot-reload",S3Key="${distDir}" \
        --handler ${handler} \
        --timeout 120 \
        --environment '${envVarsFormatted}'`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error creating function ${functionName}:`, error);
          return;
        }
        console.log(`Function ${functionName} created successfully`);
      });
    }
  }
} catch (err) {
  console.error("Error reading directory:", err);
}
