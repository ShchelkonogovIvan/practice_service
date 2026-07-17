import { AuthForm } from "@/components/auth-form";
import { OverviewLink } from "@/components/overview-link";

export default function AuthPage() {
  return (
    <main className="relative min-h-screen px-5 py-20">
      <OverviewLink className="absolute left-5 top-5" />
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-md items-center">
        <AuthForm />
      </div>
    </main>
  );
}

