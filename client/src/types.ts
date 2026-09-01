export type PieceType = 'poem' | 'prose' | 'essay' | 'story' | 'recipe' | 'found'

export type Piece = {
  id: number
  title: string
  body: string
  type: PieceType
  tags: string
  is_ai_generated: number
  published_at: string
}

/** Shape returned by GET /api/pieces. `total` counts rows matching the filter. */
export type PieceList = {
  pieces: Piece[]
  total: number
  page: number
  pageSize: number
}
