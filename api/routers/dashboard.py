from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timedelta
from ..services.table_service import table_service
from ..core.config import settings

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def is_working_day(dt: datetime) -> bool:
    return dt.weekday() < 5 # 0-4 is Mon-Fri

@router.get("/stats")
async def get_dashboard_stats():
    try:
        # 1. Fetch all data (In a real high-scale app, we'd use aggregations or specialized tables)
        orders = table_service.get_sync_data(settings.AZURE_TABLE_ORDERS if hasattr(settings, 'AZURE_TABLE_ORDERS') else "SgmOrders", None)
        tasks = table_service.get_sync_data(settings.AZURE_TABLE_TASKS, None)
        
        from datetime import timezone
        now = datetime.now(timezone.utc)
        
        # 2. Basic Counters
        total_orders = len(orders)
        attended_tasks = len([t for t in tasks if t.get('status') == 'completed'])
        pending_tasks = len([t for t in tasks if t.get('status') != 'completed'])
        critical_tasks = len([t for t in tasks if t.get('priority') == 'high' and t.get('status') != 'completed'])
        
        # 3. Weekly Advance (Last 6 Months)
        # Group tasks by week of completion
        weekly_stats = []
        
        # Start from the beginning of today
        base_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Generate last 26 weeks
        for i in range(26):
            # Calculate Monday of that week
            start_of_week = base_date - timedelta(days=base_date.weekday() + (i * 7))
            # Calculate Sunday of that week
            end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
            
            week_label = start_of_week.strftime("%d %b")
            
            count = 0
            for t in tasks:
                if t.get('status') == 'completed' and t.get('completed_at'):
                    try:
                        # Parse ISO string and ensure it's aware
                        c_at = t['completed_at']
                        if isinstance(c_at, str):
                            comp_date = datetime.fromisoformat(c_at.replace('Z', '+00:00'))
                        else:
                            comp_date = c_at # Already a datetime object from some SDKs
                            
                        if comp_date.tzinfo is None:
                            comp_date = comp_date.replace(tzinfo=timezone.utc)
                            
                        if start_of_week <= comp_date <= end_of_week:
                            count += 1
                    except Exception as e:
                        continue
                        
            weekly_stats.append({"name": week_label, "atendidos": count})
            
        weekly_stats.reverse()
        
        # 4. Productivity (Last 15 Working Days)
        working_days = []
        check_date = now
        while len(working_days) < 15:
            if is_working_day(check_date):
                working_days.append(check_date.date())
            check_date -= timedelta(days=1)
            
        productivity_tasks = 0
        for t in tasks:
            if t.get('status') == 'completed' and t.get('completed_at'):
                try:
                    c_at = t['completed_at']
                    if isinstance(c_at, str):
                        comp_date = datetime.fromisoformat(c_at.replace('Z', '+00:00'))
                    else:
                        comp_date = c_at
                    
                    if comp_date.date() in working_days:
                        productivity_tasks += 1
                except:
                    continue
                    
        # Productivity target: 8 per day * 15 days = 120
        target = 120
        productivity_score = (productivity_tasks / target) * 100 if target > 0 else 0
        
        # 5. Recent Tasks (Top 10)
        completed_tasks = [t for t in tasks if t.get('status') == 'completed' and t.get('completed_at')]
        completed_tasks.sort(key=lambda x: x.get('completed_at', ''), reverse=True)
        recent_tasks = completed_tasks[:10]
        
        return {
            "counters": {
                "total_orders": total_orders,
                "attended_tasks": attended_tasks,
                "pending_tasks": pending_tasks,
                "critical_tasks": critical_tasks
            },
            "weekly_advance": weekly_stats,
            "productivity": {
                "score": round(productivity_score, 1),
                "count": productivity_tasks,
                "target": target
            },
            "recent_tasks": recent_tasks
        }
        
    except Exception as e:
        print(f"Error calculating dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Error generating dashboard statistics")
