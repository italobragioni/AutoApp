# Logo do AUTOVOLT

Coloque aqui os arquivos da logo. O componente `src/components/brand/Logo.tsx`
os usa automaticamente e, enquanto eles não existirem (ou se falharem ao
carregar), cai numa marca vetorial de reserva — a interface nunca fica sem logo.

Arquivos esperados (FUNDO TRANSPARENTE — o app tem tema escuro):

- `autovolt-mark.png` — só o ícone (carro + raio), recorte aproximadamente
  quadrado. Usado nos espaços de ícone (barra superior, menu lateral, etc.).
- `autovolt-logo.png` — a logo completa (ícone + palavra AUTOVOLT). Usada nos
  cabeçalhos com espaço (login, cadastro, landing, assinatura, e-mails).

Dicas:
- Exporte em 2x para telas de alta densidade (ex.: ícone com ~96–128 px de
  lado; logo completa com ~600 px de largura).
- PNG com transparência, ou SVG (basta trocar a extensão nos dois `*_SRC` em
  `Logo.tsx`).

Favicon (opcional): para trocar o ícone da aba, adicione `src/app/icon.png`
(o mesmo ícone, quadrado) — o Next.js passa a usá-lo no lugar de `icon.svg`.
