# EPS + : crée le certificat https du serveur local (sans droits administrateur).
#  1. une « autorité » EPS + (à installer une fois sur chaque tablette) ;
#  2. le certificat du serveur, signé par cette autorité, pour le nom du PC et ses adresses IP.
# À relancer si l'adresse IP du PC change.
$ErrorActionPreference = 'Stop'
$dossier = Join-Path $PSScriptRoot 'certificats'
New-Item -ItemType Directory -Force $dossier | Out-Null

$autorite = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq 'CN=EPS+ Autorite locale' -and $_.NotAfter -gt (Get-Date).AddMonths(6) } | Select-Object -First 1
if (-not $autorite) {
  $autorite = New-SelfSignedCertificate -Subject 'CN=EPS+ Autorite locale' -FriendlyName 'EPS+ Autorite locale' `
    -KeyUsage CertSign, CRLSign, DigitalSignature -KeyExportPolicy Exportable -KeyLength 2048 -HashAlgorithm SHA256 `
    -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(10) `
    -TextExtension @('2.5.29.19={critical}{text}ca=true&pathlength=0')
}

$nom = $env:COMPUTERNAME
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } | ForEach-Object IPAddress
$noms = @("DNS=$nom", "DNS=$($nom.ToLower()).local", 'DNS=localhost', 'IPAddress=127.0.0.1') + ($ips | ForEach-Object { "IPAddress=$_" })
$serveur = New-SelfSignedCertificate -Subject "CN=$nom" -FriendlyName 'EPS+ serveur' -Signer $autorite `
  -KeyExportPolicy Exportable -KeyLength 2048 -HashAlgorithm SHA256 -CertStoreLocation Cert:\CurrentUser\My `
  -NotAfter (Get-Date).AddDays(800) `
  -TextExtension @("2.5.29.17={text}$($noms -join '&')", '2.5.29.37={text}1.3.6.1.5.5.7.3.1')

$motDePasse = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
Set-Content -Path (Join-Path $dossier 'mot-de-passe.txt') -Value $motDePasse -Encoding ascii -NoNewline
Export-PfxCertificate -Cert $serveur -FilePath (Join-Path $dossier 'serveur.pfx') -ChainOption BuildChain `
  -Password (ConvertTo-SecureString $motDePasse -AsPlainText -Force) | Out-Null
Export-Certificate -Cert $autorite -FilePath (Join-Path $dossier 'eps-plus-autorite.cer') | Out-Null

Write-Host ''
Write-Host 'Certificat cree pour :' ($noms -join ', ')
Write-Host "A installer sur chaque tablette : $(Join-Path $dossier 'eps-plus-autorite.cer')"
Write-Host 'Puis redemarrer le serveur (demarrer-serveur.cmd).'
