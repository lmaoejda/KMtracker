import { AuthForm } from "@/components/AuthForm";
import { Topbar } from "@/components/Topbar";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <Topbar user={null} />
      <AuthForm mode="login" />
    </>
  );
}
