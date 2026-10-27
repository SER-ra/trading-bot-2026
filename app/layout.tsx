export const metadata = {
  title: "Trading Bots Dashboard",
  description: "Dashboard para acompanhar os bots de paper trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}

