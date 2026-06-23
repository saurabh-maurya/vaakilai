from fastapi import APIRouter, Depends
from middleware.auth_middleware import require_pro_plan
from pydantic import BaseModel
from agents.prediction_agent import predict_outcome

router = APIRouter()


class PredictRequest(BaseModel):
    case_facts: str
    practice_area: str = ""
    court: str = ""


@router.post("")
async def predict(body: PredictRequest, current_user: dict = Depends(require_pro_plan)):
    return await predict_outcome(
        case_facts=body.case_facts,
        practice_area=body.practice_area,
        court=body.court,
    )
