Write-Host "Testing Node.js and npm environment..."
Write-Host "=================================="

# Check Node.js and npm versions
$nodeVersion = node -v
$npmVersion = npm -v

Write-Host "Node.js version: $nodeVersion"
Write-Host "npm version: $npmVersion"

# Check npm configuration
Write-Host "`nnpm configuration:"
npm config list

# Check environment variables
Write-Host "`nEnvironment Variables:"
$env:Path -split ';' | Where-Object { $_ -like "*node*" -or $_ -like "*npm*" } | ForEach-Object {
    Write-Host "- $_"
}

# Try to create a test directory and install a package
$testDir = "$pwd\npm-test-dir"
New-Item -ItemType Directory -Force -Path $testDir | Out-Null

Set-Location $testDir
Write-Host "`nTesting package installation in: $testDir"

npm init -y | Out-Null
npm install express --no-package-lock --no-save

# Clean up
Set-Location ..
Remove-Item -Recurse -Force $testDir

Write-Host "`nTest complete!"
