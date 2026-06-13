export type PieceType = 'poem' | 'prose' | 'essay' | 'story'

export type Piece = {
  id: number
  title: string
  body: string
  type: PieceType
  tags: string
  is_ai_generated: number
  published_at: string
}
