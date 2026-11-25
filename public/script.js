const $ = id => document.getElementById(id)
let filmes = []
async function api(url, metodo = 'GET', dados) {
    const r = await fetch(url, {
        method: metodo, headers: { 'Content-Type': 'application/json' },
        body: dados === undefined ? undefined : JSON.stringify(dados)
    })
    if (r.status === 204) return
    const json = await r.json()
    if (!r.ok) throw new Error(json.error || 'Falha na operação')
    return json
}
async function executar(fn) {
    try { await fn() } catch (e) { $('mensagem').textContent = e.message }
}
function elemento(tag, texto, classe) {
    const el = document.createElement(tag)
    el.textContent = texto
    if (classe) el.className = classe
    return el
}
function botao(texto, acao, classe) {
    const b = elemento('button', texto, classe)
    b.onclick = () => executar(acao)
    return b
}
async function carregar() {
    filmes = await api('/api/filmes')
    const d = await api('/api/indicadores')
    $('indicadores').replaceChildren()
    for (const [nome, valor] of [['Filmes', d.filmes],
    ['Avaliações', d.avaliacoes], ['Nota média', d.media ?? '-']]) {
        const card = elemento('article', nome)
        card.append(elemento('strong', valor))
        $('indicadores').append(card)
    }
    renderizar()
}
// Cria o pôster sem inserir HTML vindo do usuário.
function poster(url, titulo) {
    const quadro = elemento('div', '', 'poster')
    const fallback = () => quadro.replaceChildren(elemento('span', '[Filme] Sem pôster disponível'))
    fallback()
    try {
        const endereco = new URL(url)
        if (!['http:', 'https:'].includes(endereco.protocol)) return quadro
        const img = document.createElement('img')
        img.alt = `Pôster de ${titulo || 'filme'}`
        img.loading = 'lazy'
        img.referrerPolicy = 'no-referrer'
        img.onerror = fallback
        img.src = endereco.href
        quadro.replaceChildren(img)
    } catch { /* Campo vazio ou URL inválida: mantém o placeholder. */ }
    return quadro
}
function atualizarPreview() {
    const url = $('imagem_url').value.trim()
    $('preview').hidden = !url
    $('preview').replaceChildren(...(url ? [poster(url, $('titulo').value)] : []))
}
$('imagem_url').addEventListener('change', atualizarPreview)
function renderizar() {
    $('lista').replaceChildren()
    const busca = $('busca').value.toLowerCase()
    for (const f of filmes.filter(f => f.titulo.toLowerCase().includes(busca))) {
        const card = document.createElement('article')
        card.append(poster(f.imagem_url, f.titulo), elemento('h3', f.titulo),
            elemento('p', `${f.genero} | ${f.ano}`),
            elemento('p', `Nota: ${f.media ?? '-'} (${f.total} avaliações)`, 'nota'),
            botao('Editar', () => editar(f)),
            botao('Avaliar', () => avaliar(f.id)),
            botao('Excluir', () => excluir(f.id), 'excluir'))
        $('lista').append(card)
    }
}
function editar(f) {
    $('id').value = f.id
    $('titulo').value = f.titulo
    $('ano').value = f.ano
    $('genero').value = f.genero_id
    $('imagem_url').value = f.imagem_url || ''
    atualizarPreview()
    $('titulo-form').textContent = 'Editar filme'
    $('titulo').focus()
}
function limpar() {
    $('form').reset()
    atualizarPreview()
    $('id').value = ''
    $('titulo-form').textContent = 'Novo filme'
}
function ordenarAvaliacao() {
    filmes.sort((a, b) => (b.media ?? 0) - (a.media ?? 0))

    renderizar()
}
$('ordenar-avaliacao').onclick = ordenarAvaliacao
$('form').onsubmit = event => {
    event.preventDefault()
    executar(async () => {
        const id = $('id').value
        await api(id ? `/api/filmes/${id}` : '/api/filmes', id ? 'PUT' : 'POST', {
            titulo: $('titulo').value, ano: Number($('ano').value),
            genero_id: Number($('genero').value),
            imagem_url: $('imagem_url').value.trim() || null
        })
        limpar()
        await carregar()
        $('mensagem').textContent = 'Filme salvo!'
    })
}
async function avaliar(id) {
    const entrada = prompt('Digite uma nota de 0 a 10:')
    if (entrada === null) return
    const nota = Number(entrada.replace(',', '.'))
    if (!entrada.trim() || !Number.isFinite(nota) || nota < 0 || nota > 10)
        throw new Error('Informe uma nota válida')
    await api(`/api/filmes/${id}/avaliacoes`, 'POST', { nota })
    await carregar()
    $('mensagem').textContent = 'Avaliação registrada!'
}
async function excluir(id) {
    if (!confirm('Excluir filme e todas as suas avaliações?')) return
    await api(`/api/filmes/${id}`, 'DELETE')
    limpar()
    await carregar()
    $('mensagem').textContent = 'Filme excluído!'
}
$('cancelar').onclick = limpar
$('busca').oninput = renderizar
executar(async () => {
    const generos = await api('/api/generos')
    for (const g of generos) {
        const op = elemento('option', g.nome)
        op.value = g.id
        $('genero').append(op)
    }
    await carregar()
})