export const metadata = {
  title: "Trading Bots Control",
  description: "Painel de controlo futurista para os bots de paper trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

