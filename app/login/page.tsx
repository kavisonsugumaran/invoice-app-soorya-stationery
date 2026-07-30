import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/ui/Logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="flex flex-col items-center gap-2">
        <Logo size={40} />
        <span className="text-lg font-semibold text-foreground">KadeBill</span>
      </div>
      <LoginForm />
    </div>
  );
}
