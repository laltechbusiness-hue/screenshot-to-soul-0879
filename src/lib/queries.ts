import { queryOptions } from "@tanstack/react-query";
import {
  getInstitution,
  getProfessor,
  searchInstitutions,
  searchProfessors,
} from "./public-data.functions";

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
    staleTime: 60_000,
  });

export const facultyQuery = (id: string, q = "", departmentId?: string, page = 0) =>
  queryOptions({
    queryKey: ["institution", id, "faculty", q, departmentId, page],
    queryFn: () =>
      searchProfessors({ data: { id, q, ...(departmentId ? { departmentId } : {}), page } }),
    staleTime: 60_000,
  });

export const professorQuery = (id: string) =>
  queryOptions({
    queryKey: ["professor", id],
    queryFn: () => getProfessor({ data: { id } }),
    staleTime: 30_000,
  });

export type ProfessorData = NonNullable<Awaited<ReturnType<typeof getProfessor>>>;
export type ReviewRow = ProfessorData["reviews"][number];
