import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pieces from './routes/pieces.js'

const app = new Hono()

app.use('/api/*', cors())
app.route('/api/pieces', pieces)

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Server running on http://localhost:3000')
})
