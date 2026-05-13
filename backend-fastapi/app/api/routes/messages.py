"""
消息 API 路由
"""
from fastapi import APIRouter, HTTPException, Request
from app.models import Message, db

router = APIRouter()


@router.get('/{message_id}')
def get_message(message_id: int):
    """获取特定消息详情"""
    message = Message.query.get(message_id)
    if not message:
        raise HTTPException(status_code=404, detail='消息未找到')

    from app.services.message_service import MessageService
    result = MessageService.format_message_for_api(message)
    result['action_task_id'] = message.action_task_id
    return result


@router.put('/{message_id}')
async def update_message(message_id: int, request: Request):
    """更新消息内容"""
    message = Message.query.get(message_id)
    if not message:
        raise HTTPException(status_code=404, detail='消息未找到')

    data = await request.json()

    if 'content' in data:
        message.content = data['content']

    db.session.commit()
    return {'message': '消息更新成功', 'id': message.id}


@router.delete('/{message_id}')
def delete_message(message_id: int):
    """删除消息"""
    message = Message.query.get(message_id)
    if not message:
        raise HTTPException(status_code=404, detail='消息未找到')

    db.session.delete(message)
    db.session.commit()
    return {'message': '消息已删除'}
