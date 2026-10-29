import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-bold">Страница не найдена</h1>
      <Link to="/" className="mt-3 inline-block underline">
        На главную
      </Link>
    </div>
  );
}
