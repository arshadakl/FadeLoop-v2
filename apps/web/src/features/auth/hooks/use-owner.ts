import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loginOwner, logoutOwner } from "../api/owner-mutations";
import { getOwnerSession, ownerKeys } from "../api/owner-queries";

export function useOwner() {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ownerKeys.session,
    queryFn: ({ signal }) => getOwnerSession(signal),
    staleTime: 0,
  });
  const login = useMutation({
    gcTime: 0,
    mutationFn: loginOwner,
    onSuccess: async () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      await queryClient.invalidateQueries({ queryKey: ownerKeys.session });
    },
  });
  const logout = useMutation({
    mutationFn: logoutOwner,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(ownerKeys.session, null);
    },
  });
  return { session, login, logout };
}
