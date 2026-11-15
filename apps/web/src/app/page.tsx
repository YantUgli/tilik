import { Landing } from "@/components/landing";
import { Analyzer } from "@/features/result/analyzer";

export default function Home() {
  return (
    <main className="container">
      <Landing />
      <Analyzer />
    </main>
  );
}
