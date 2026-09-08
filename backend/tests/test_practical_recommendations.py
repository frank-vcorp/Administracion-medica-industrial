"""Tests AMI-SR F-017 R-06 — recomendaciones prácticas."""

from app.services.ai.practical_recommendations import (
    AUDIOMETRIA_PRACTICAL,
    ESPIROMETRIA_PRACTICAL,
    derive_practical_recommendation,
)


class TestDerivePracticalRecommendation:
    def test_espirometria_normal(self):
        result = derive_practical_recommendation(
            "Espirometria",
            {},
            {
                "summary": "Función pulmonar normal; FVC 94%",
                "clinical_state": "AI_PENDING_REVIEW",
            },
        )
        assert result == ESPIROMETRIA_PRACTICAL["normal"]

    def test_espirometria_restrictivo(self):
        result = derive_practical_recommendation(
            "Espirometria",
            {},
            {
                "summary": "Patrón sugestivo de restricción; FVC 70%",
                "clinical_state": "AI_PENDING_REVIEW",
            },
        )
        assert result == ESPIROMETRIA_PRACTICAL["restrictivo"]

    def test_audiometria_normal(self):
        result = derive_practical_recommendation(
            "Audiometria",
            {},
            {
                "summary": "Audición bilateral dentro de límites normales",
                "clinical_state": "AI_PENDING_REVIEW",
                "clasificacion_hipoacusia": {
                    "right": "NO_APLICA",
                    "left": "NO_APLICA",
                    "bilateral": "NO_APLICA",
                },
            },
        )
        assert result == AUDIOMETRIA_PRACTICAL["normal"]

    def test_audiometria_hipoacusia(self):
        result = derive_practical_recommendation(
            "Audiometria",
            {},
            {
                "summary": "Hipoacusia leve bilateral",
                "clinical_state": "AI_PENDING_REVIEW",
                "clasificacion_hipoacusia": {
                    "right": "LEVE",
                    "left": "LEVE",
                    "bilateral": "LEVE",
                },
            },
        )
        assert result == AUDIOMETRIA_PRACTICAL["hipoacusia"]

    def test_non_conclusive_espirometria(self):
        result = derive_practical_recommendation(
            "Espirometria",
            {},
            {"summary": "No concluyente", "clinical_state": "AI_NON_CONCLUSIVE"},
        )
        assert result == ESPIROMETRIA_PRACTICAL["non_conclusive"]
