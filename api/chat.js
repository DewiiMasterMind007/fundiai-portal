export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { bot, clientInstructions, fundiFileText, messages } = req.body

    const basePrompt =
      bot === 'poppie'
        ? process.env.POPPIE_SYSTEM_PROMPT
        : bot === 'chad'
          ? process.env.CHAD_SYSTEM_PROMPT
          : ''

    const systemPrompt =
      'CLIENT FUNDI.FILE:\n' +
      fundiFileText +
      '\n\n---\n\nCLIENT-SPECIFIC INSTRUCTIONS FOR THIS BOT:\n' +
      (clientInstructions || '') +
      '\n\n---\n\n' +
      basePrompt

    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 800,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      },
    )

    const data = await openaiResponse.json()

    if (!openaiResponse.ok) {
      return res.status(500).json(data)
    }

    const reply = data.choices?.[0]?.message?.content ?? ''
    return res.status(200).json({ reply })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
