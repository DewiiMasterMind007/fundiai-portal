// Shared Tailwind descendant-selector styling for markdown rendered inside
// a bot's blue gradient bubble (Chat.jsx, Notifications.jsx) — react-markdown
// renders plain h1/p/ul/etc. with no classes of its own, so Tailwind's
// preflight reset otherwise leaves headings/lists looking like a single
// unstyled paragraph.
export const ASSISTANT_MARKDOWN_CLASSES = [
  '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold',
  '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold',
  '[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-bold',
  '[&_p]:mb-2 [&_p]:leading-relaxed',
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
  '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
  '[&_li]:leading-relaxed',
  '[&_strong]:font-bold',
  '[&_em]:italic',
  '[&_a]:underline [&_a]:underline-offset-2',
  '[&>*:first-child]:mt-0',
  '[&>*:last-child]:mb-0',
].join(' ')
