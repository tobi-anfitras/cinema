import Fastify from 'fastify'
import { Pool } from 'pg'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'node:url'
const app = Fastify({ logger: true })
const db = new Pool({
    user: 'postgres', host: 'localhost', port: 5432,
    database: 'filmes', password: process.env.DB_PASSWORD
})
app.register(fastifyStatic, {
    root: fileURLToPath(new URL('./public/', import.meta.url))
})
app.get('/api/generos', async () => {
    const r = await db.query('SELECT * FROM generos ORDER BY nome')
    return r.rows
})
app.get('/api/filmes', async () => {
    const r = await db.query(`
 SELECT f.id, f.titulo, f.ano, f.genero_id, f.imagem_url, g.nome AS genero,
 ROUND(AVG(a.nota), 1) AS media,
 COUNT(a.id)::int AS total
 FROM filmes f JOIN generos g ON g.id = f.genero_id
 LEFT JOIN avaliacoes a ON a.filme_id = f.id
 GROUP BY f.id, g.nome ORDER BY f.titulo
 `)
    return r.rows
})
// Aceita apenas URLs HTTP/HTTPS ou campo vazio.
function imagemValida(valor) {
    if (valor === undefined || valor === null || valor === '') return true
    if (typeof valor !== 'string' || valor.length > 2048) return false
    try {
        const url = new URL(valor.trim())
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch { return false }
}
function dadosValidos(b) {
    return typeof b?.titulo === 'string' && b.titulo.trim() &&
        b.titulo.length <= 150 && Number.isInteger(b.ano) &&
        b.ano >= 1888 && Number.isInteger(b.genero_id) && b.genero_id > 0 && imagemValida(b.imagem_url)
}
app.post('/api/filmes', async (req, reply) => {
    const b = req.body
    if (!dadosValidos(b)) return reply.code(400).send({ error: 'Dados inválidos' })
    const r = await db.query(
        'INSERT INTO filmes (titulo, ano, genero_id, imagem_url) VALUES ($1,$2,$3,$4) RETURNING id',
        [b.titulo.trim(), b.ano, b.genero_id, b.imagem_url?.trim() || null])
    return reply.code(201).send(r.rows[0])
})
app.put('/api/filmes/:id', async (req, reply) => {
    const b = req.body
    if (!dadosValidos(b)) return reply.code(400).send({ error: 'Dados inválidos' })
    const r = await db.query(
        'UPDATE filmes SET titulo=$1, ano=$2, genero_id=$3, imagem_url=$4 WHERE id=$5',
        [b.titulo.trim(), b.ano, b.genero_id, b.imagem_url?.trim() || null, req.params.id])
    if (!r.rowCount) return reply.code(404).send({ error: 'Filme não encontrado' })
    return { mensagem: 'Filme atualizado' }
})
app.delete('/api/filmes/:id', async (req, reply) => {
    const r = await db.query('DELETE FROM filmes WHERE id=$1', [req.params.id])
    if (!r.rowCount) return reply.code(404).send({ error: 'Filme não encontrado' })
    return reply.code(204).send({ mensagem: 'filme apagado' })
})
app.post('/api/filmes/:id/avaliacoes', async (req, reply) => {
    const nota = req.body?.nota
    if (typeof nota !== 'number' || !Number.isFinite(nota) || nota < 0 || nota > 10)
        return reply.code(400).send({ error: 'Nota deve estar entre 0 e 10' })
    await db.query('INSERT INTO avaliacoes (filme_id, nota) VALUES ($1,$2)',
        [req.params.id, nota])
    return reply.code(201).send({ mensagem: 'Avaliação registrada' })
})
app.get('/api/indicadores', async () => {
    const r = await db.query(`SELECT
 (SELECT COUNT(*) FROM filmes)::int AS filmes,
 COUNT(*)::int AS avaliacoes, ROUND(AVG(nota),1) AS media
 FROM avaliacoes`)
    return r.rows[0]
})

app.get("/filmes", async (req, res) => {
    try {
        let query = "SELECT * FROM filmes";
        if (req.query.ordenar === "avaliacao") {
            query += " ORDER BY avaliacao DESC";
        }
        const resultado = await pool.query(query);
        res.json(resultado.rows);
    } catch (erro) {
        res.status(500).json({
            erro: "Erro ao buscar filmes"
        });
    }
});
app.setErrorHandler((err, req, reply) => {
    req.log.error(err)
    const invalido = ['23503', '23514', '22P02'].includes(err.code)
    reply.code(invalido ? 400 : 500).send({
        error: invalido ? 'Dados ou relacionamento inválidos' : 'Erro interno do servidor'
    })
})
await db.query('SELECT 1')
await app.listen({ port: Number(process.env.PORT || 3000) });