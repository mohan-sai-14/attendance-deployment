# PowerShell script to download face-api.js models
$modelsDir = Join-Path $PSScriptRoot "models"

if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir | Out-Null
    Write-Host "Created models directory"
}

$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
$models = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
    "face_expression_model-weights_manifest.json",
    "face_expression_model-shard1"
)

Write-Host "Downloading face-api.js models..."

foreach ($model in $models) {
    $url = $baseUrl + $model
    $dest = Join-Path $modelsDir $model
    Write-Host "Downloading: $model"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

Write-Host "All models downloaded successfully!"
Write-Host "Models saved to: $modelsDir"
