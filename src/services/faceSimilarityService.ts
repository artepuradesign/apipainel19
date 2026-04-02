import { apiRequest, fetchApiConfig } from '@/config/api';
import { cookieUtils } from '@/utils/cookieUtils';

export type FaceLandmark = { x: number; y: number; z?: number };

export type FaceSimilarityResult = {
  id: number;
  photo_filename: string;
  photo_url: string | null;
  gender?: string | null;
  similaridade: number;
  processed_at?: string | null;
};

type FaceSimilarityApiResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    total_found: number;
    max_results: number;
    threshold: number;
    gender_filter?: string | null;
    results: FaceSimilarityResult[];
  };
};

export type FaceGenderFilter = 'male' | 'female';

export const faceSimilarityService = {
  async searchByLandmarks(
    landmarks: FaceLandmark[],
    limit = 10,
    threshold = 70,
    gender?: FaceGenderFilter
  ) {
    try {
      await fetchApiConfig();
      const token = cookieUtils.get('auth_token') || cookieUtils.get('session_token');

      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const result = await apiRequest<FaceSimilarityApiResponse>('/face-similarity/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ landmarks, limit, threshold, gender }),
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao consultar similaridade facial');
      }

      return {
        success: true,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        data: {
          total_found: 0,
          max_results: 10,
          threshold,
          results: [],
        },
      };
    }
  },
};
