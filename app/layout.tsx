export const metadata = {
  title: "Trading Bots Dashboard",
  description: "Painel de controlo interativo para os bots de paper trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body style={{ margin: 0, background: "#fafafa" }}>{children}</body>
    </html>
  );
}

