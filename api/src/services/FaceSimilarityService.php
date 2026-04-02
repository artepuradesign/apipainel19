<?php

class FaceSimilarityService {
    private $db;
    private $photoBaseUrl = 'http://api.apipainel.com.br/base_dados/FOTOS/';
    private $genderColumn = null;

    public function __construct($datafaceDb) {
        $this->db = $datafaceDb;
    }

    private function normalizeLandmarks($landmarks) {
        if (!is_array($landmarks)) return [];

        $normalized = [];
        foreach ($landmarks as $point) {
            if (!is_array($point)) continue;
            if (!isset($point['x']) || !isset($point['y'])) continue;

            $normalized[] = [
                'x' => (float)$point['x'],
                'y' => (float)$point['y'],
                'z' => isset($point['z']) ? (float)$point['z'] : 0.0,
            ];
        }

        return $normalized;
    }

    private function compareLandmarks($queryLandmarks, $candidateLandmarks) {
        $sampleIndexes = [1, 10, 33, 61, 94, 133, 152, 168, 199, 234, 263, 291, 323, 356, 389, 454];
        $distanceSum = 0.0;
        $count = 0;

        foreach ($sampleIndexes as $idx) {
            if (!isset($queryLandmarks[$idx]) || !isset($candidateLandmarks[$idx])) {
                continue;
            }

            $qx = (float)($queryLandmarks[$idx]['x'] ?? 0);
            $qy = (float)($queryLandmarks[$idx]['y'] ?? 0);
            $qz = (float)($queryLandmarks[$idx]['z'] ?? 0);

            $cx = (float)($candidateLandmarks[$idx]['x'] ?? 0);
            $cy = (float)($candidateLandmarks[$idx]['y'] ?? 0);
            $cz = (float)($candidateLandmarks[$idx]['z'] ?? 0);

            $dx = $qx - $cx;
            $dy = $qy - $cy;
            $dz = $qz - $cz;

            $distanceSum += sqrt(($dx * $dx) + ($dy * $dy) + ($dz * $dz));
            $count++;
        }

        if ($count === 0) return 0.0;

        $avgDistance = $distanceSum / $count;
        $similarity = 100.0 - ($avgDistance * 180.0);
        return max(0.0, min(100.0, $similarity));
    }

    private function normalizeGender($gender) {
        if (!is_string($gender)) return null;
        $value = mb_strtolower(trim($gender));
        if ($value === '') return null;

        if (in_array($value, ['male', 'masculino', 'masc', 'm', 'homem'], true)) {
            return 'male';
        }

        if (in_array($value, ['female', 'feminino', 'fem', 'f', 'mulher'], true)) {
            return 'female';
        }

        return null;
    }

    private function genderVariants($normalizedGender) {
        if ($normalizedGender === 'male') {
            return ['male', 'masculino', 'm', 'homem'];
        }

        if ($normalizedGender === 'female') {
            return ['female', 'feminino', 'f', 'mulher'];
        }

        return [];
    }

    private function resolveGenderColumn() {
        if ($this->genderColumn !== null) {
            return $this->genderColumn;
        }

        try {
            $stmt = $this->db->query("SHOW COLUMNS FROM faces_base");
            $columns = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN, 0) : [];
            if (!is_array($columns)) {
                $this->genderColumn = false;
                return $this->genderColumn;
            }

            foreach ($columns as $column) {
                $field = mb_strtolower((string)$column);
                if (in_array($field, ['gender', 'sexo', 'sex'], true)) {
                    $this->genderColumn = $field;
                    return $this->genderColumn;
                }
            }
        } catch (Exception $e) {
            error_log('FACE_SIMILARITY: Não foi possível resolver coluna de gênero: ' . $e->getMessage());
        }

        $this->genderColumn = false;
        return $this->genderColumn;
    }

    private function getCandidateRows($queryLandmarks, $gender = null) {
        $p1 = $queryLandmarks[1] ?? null;
        $p33 = $queryLandmarks[33] ?? null;
        $p263 = $queryLandmarks[263] ?? null;
        $normalizedGender = $this->normalizeGender($gender);
        $genderColumn = $normalizedGender ? $this->resolveGenderColumn() : false;
        $genderValues = $normalizedGender ? $this->genderVariants($normalizedGender) : [];

        $genderFilterSql = '';
        $genderParams = [];

        if ($normalizedGender && $genderColumn && !empty($genderValues)) {
            $placeholders = [];
            foreach ($genderValues as $idx => $value) {
                $key = ':g' . $idx;
                $placeholders[] = $key;
                $genderParams[$key] = $value;
            }
            $genderFilterSql = " AND LOWER(TRIM($genderColumn)) IN (" . implode(', ', $placeholders) . ')';
        }

        $genderSelect = $genderColumn ? ", $genderColumn AS gender" : '';

        if ($p1 && $p33 && $p263) {
            $range = 0.12;
            $sql = "
                SELECT id, photo_filename, landmarks, width, height, processed_at $genderSelect
                FROM faces_base
                WHERE JSON_VALID(landmarks)
                  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(landmarks, '$[1].x')) AS DECIMAL(10,6)) BETWEEN :p1xMin AND :p1xMax
                  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(landmarks, '$[1].y')) AS DECIMAL(10,6)) BETWEEN :p1yMin AND :p1yMax
                  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(landmarks, '$[33].x')) AS DECIMAL(10,6)) BETWEEN :p33xMin AND :p33xMax
                  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(landmarks, '$[263].x')) AS DECIMAL(10,6)) BETWEEN :p263xMin AND :p263xMax
                  $genderFilterSql
                ORDER BY id DESC
                LIMIT 5000
            ";

            $stmt = $this->db->prepare($sql);
            $params = [
                ':p1xMin' => $p1['x'] - $range,
                ':p1xMax' => $p1['x'] + $range,
                ':p1yMin' => $p1['y'] - $range,
                ':p1yMax' => $p1['y'] + $range,
                ':p33xMin' => $p33['x'] - $range,
                ':p33xMax' => $p33['x'] + $range,
                ':p263xMin' => $p263['x'] - $range,
                ':p263xMax' => $p263['x'] + $range,
            ];

            foreach ($genderParams as $key => $value) {
                $params[$key] = $value;
            }

            $stmt->execute($params);

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) {
                return $rows;
            }
        }

        $fallbackSql = "
            SELECT id, photo_filename, landmarks, width, height, processed_at $genderSelect
            FROM faces_base
            WHERE JSON_VALID(landmarks)
            $genderFilterSql
            ORDER BY id DESC
            LIMIT 5000
        ";

        $fallbackStmt = $this->db->prepare($fallbackSql);
        $fallbackStmt->execute($genderParams);
        return $fallbackStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function searchByLandmarks($landmarks, $limit = 10, $minSimilarity = 70, $gender = null) {
        $queryLandmarks = $this->normalizeLandmarks($landmarks);
        if (count($queryLandmarks) < 100) {
            throw new Exception('Landmarks insuficientes para comparar');
        }

        $limit = max(1, min(10, (int)$limit));
        $minSimilarity = max(0, min(100, (float)$minSimilarity));

        $rows = $this->getCandidateRows($queryLandmarks, $gender);
        $results = [];

        foreach ($rows as $row) {
            $candidateLandmarks = json_decode($row['landmarks'] ?? '[]', true);
            if (!is_array($candidateLandmarks) || empty($candidateLandmarks)) continue;

            $similarity = $this->compareLandmarks($queryLandmarks, $candidateLandmarks);
            if ($similarity < $minSimilarity) continue;

            $photoFilename = trim((string)($row['photo_filename'] ?? ''));

            $results[] = [
                'id' => (int)$row['id'],
                'photo_filename' => $photoFilename,
                'photo_url' => $photoFilename !== '' ? $this->photoBaseUrl . rawurlencode($photoFilename) : null,
                'gender' => $row['gender'] ?? null,
                'similaridade' => round($similarity, 2),
                'processed_at' => $row['processed_at'] ?? null,
            ];
        }

        usort($results, function($a, $b) {
            return $b['similaridade'] <=> $a['similaridade'];
        });

        return array_slice($results, 0, $limit);
    }
}
