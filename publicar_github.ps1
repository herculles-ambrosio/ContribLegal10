# Script para publicar no GitHub
# Autor: ContribLegal10
# Uso: .\publicar_github.ps1

# Verificar se o Git está instalado
try {
    $gitVersion = git --version
    Write-Host "Git encontrado: $gitVersion" -ForegroundColor Green
}
catch {
    Write-Host "Git não encontrado. Por favor, instale o Git antes de continuar." -ForegroundColor Red
    exit 1
}

# Verificar se o repositório já está inicializado
if (Test-Path ".git") {
    Write-Host "Repositório Git já inicializado." -ForegroundColor Yellow
}
else {
    Write-Host "Inicializando repositório Git..." -ForegroundColor Cyan
    git init
    Write-Host "Repositório Git inicializado com sucesso!" -ForegroundColor Green
}

# Adicionar os arquivos ao controle de versão
Write-Host "Adicionando arquivos ao controle de versão..." -ForegroundColor Cyan
git add .

# Verificar o status
git status

# Perguntar se quer continuar
$continuar = Read-Host "Deseja continuar com o commit e push? (S/N)"
if ($continuar -ne "S" -and $continuar -ne "s") {
    Write-Host "Operação cancelada pelo usuário." -ForegroundColor Yellow
    exit 0
}

# Fazer o commit inicial
$mensagem = Read-Host "Digite a mensagem do commit (padrão: 'Versão inicial')"
if ([string]::IsNullOrWhiteSpace($mensagem)) {
    $mensagem = "Versão inicial"
}

Write-Host "Criando commit inicial..." -ForegroundColor Cyan
git commit -m $mensagem
Write-Host "Commit criado com sucesso!" -ForegroundColor Green

# Verificar se já existe um remote origin
$remoteExists = git remote -v | Select-String -Pattern "origin"
if ($remoteExists) {
    Write-Host "Remote 'origin' já configurado." -ForegroundColor Yellow
    $remoteUrl = git remote get-url origin
    Write-Host "URL atual: $remoteUrl" -ForegroundColor Yellow
    
    $alterarRemote = Read-Host "Deseja alterar o remote? (S/N)"
    if ($alterarRemote -eq "S" -or $alterarRemote -eq "s") {
        git remote remove origin
        $remoteExists = $false
    }
}

# Adicionar remote se necessário
if (-not $remoteExists) {
    Write-Host "Configurando repositório remoto..." -ForegroundColor Cyan
    $usuario = Read-Host "Digite seu nome de usuário do GitHub"
    
    # Verificar se o nome do repositório foi fornecido
    $repo = "ContribLegal10"
    
    # Criar a URL do repositório
    $repoUrl = "https://github.com/$usuario/$repo.git"
    
    # Adicionar o repositório remoto
    git remote add origin $repoUrl
    Write-Host "Repositório remoto configurado: $repoUrl" -ForegroundColor Green
}

# Fazer push para o GitHub
Write-Host "Enviando código para o GitHub..." -ForegroundColor Cyan
$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = "main"
}

Write-Host "Enviando para a branch '$branch'..." -ForegroundColor Cyan
git push -u origin $branch

Write-Host "Repositório publicado com sucesso no GitHub!" -ForegroundColor Green
Write-Host "Verifique em: https://github.com/$usuario/$repo" -ForegroundColor Green 