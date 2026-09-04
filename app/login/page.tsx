import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/ui/Logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 bg-background p-6">
      <Logo height={130} />
      <LoginForm />
    </div>
  );
}
