import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  placesApi,
  type PlaceInput,
  type PlacePatchInput,
} from '../lib/api/places';
import type { Id } from '../lib/types';

export function usePlaces() {
  return useQuery({ queryKey: ['places'], queryFn: placesApi.list });
}

export function usePlaceMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['places'] });
  return {
    create: useMutation({
      mutationFn: (input: PlaceInput) => placesApi.create(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: Id; patch: PlacePatchInput }) =>
        placesApi.update(id, patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: Id) => placesApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
