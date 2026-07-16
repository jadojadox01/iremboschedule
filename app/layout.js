import "./globals.css";

export const metadata = {
  title: "Irembo Schedule Availability Monitor",
  description: "Monitor Irembo driving test schedule availability changes."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
