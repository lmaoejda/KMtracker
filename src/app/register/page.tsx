import { AuthForm } from "@/components/AuthForm";
import { Topbar } from "@/components/Topbar";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <Topbar user={null} />
      <AuthForm mode="register" />
    </>
  );
}
