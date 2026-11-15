import { queryOptions } from "@tanstack/react-query";
import { getInstitution, getProfessor, searchInstitutions } from "./public-data.functions";

export const institutionsQuery = (q: string) =>
  queryOptions({
    queryKey: ["institutions", q],
    queryFn: () => searchInstitutions({ data: { q } }),
    staleTime: 30_000,
  });

export const institutionQuery = (id: string) =>
  queryOptions({
    queryKey: ["institution", id],
    queryFn: () => getInstitution({ data: { id } }),
  });

export const professorQuery = (id: string) =>
  queryOptions({
    queryKey: ["professor", id],
    queryFn: () => getProfessor({ data: { id } }),
  });

export type ProfessorData = NonNullable<Awaited<ReturnType<typeof getProfessor>>>;
export type ReviewRow = ProfessorData["reviews"][number];
