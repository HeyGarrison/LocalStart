import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { Button } from "@/components/ui/button";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <a href="https://react.dev" target="_blank">
        <img
          src={reactLogo}
          className="w-24 h-24 mx-auto mb-4"
          alt="React logo"
        />
      </a>
      <h1 className="text-4xl font-bold mb-4">React</h1>
      <div className="mb-8">
        <Button
          onClick={() => setCount((count) => count + 1)}
          className="text-lg px-6 py-3"
        >
          count is {count}
        </Button>
      </div>
      <p className="text-lg mb-8">
        Edit{" "}
        <code className="font-mono bg-muted px-2 py-1 rounded">
          apps/react/src/App.tsx
        </code>{" "}
        and save to test HMR
      </p>
    </div>
  );
}

export default App;
