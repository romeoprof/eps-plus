# Petit serveur local pour essayer l'application sur ce PC : http://localhost:8765
param([int]$Port = 8765)

$racine = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'
}

$ecoute = New-Object System.Net.HttpListener
$ecoute.Prefixes.Add("http://localhost:$Port/")
$ecoute.Start()
Write-Host "Application disponible sur http://localhost:$Port/"

while ($ecoute.IsListening) {
  $demande = $ecoute.GetContext()
  $reponse = $demande.Response
  try {
    $chemin = [Uri]::UnescapeDataString($demande.Request.Url.AbsolutePath).TrimStart('/')
    if ($chemin -eq '' -or $chemin.EndsWith('/')) { $chemin += 'index.html' }
    $fichier = [IO.Path]::GetFullPath((Join-Path $racine $chemin))
    if ($fichier.StartsWith($racine) -and (Test-Path $fichier -PathType Leaf)) {
      $octets = [IO.File]::ReadAllBytes($fichier)
      $type = $types[[IO.Path]::GetExtension($fichier).ToLower()]
      if ($type) { $reponse.ContentType = $type }
      $reponse.Headers.Add('Cache-Control', 'no-store')
      $reponse.ContentLength64 = $octets.Length
      $reponse.OutputStream.Write($octets, 0, $octets.Length)
    } else {
      $reponse.StatusCode = 404
    }
  } finally {
    $reponse.Close()
  }
}
