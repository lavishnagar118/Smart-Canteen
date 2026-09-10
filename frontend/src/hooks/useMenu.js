import { useCallback, useEffect, useState } from "react";
import { getMenu } from "../services/menuService";

export default function useMenu(params = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMenu(params);
      setItems(response.data.data?.items || []);
      setPagination(response.data.data?.pagination || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  return { items, pagination, loading, error, reload: loadMenu };
}
