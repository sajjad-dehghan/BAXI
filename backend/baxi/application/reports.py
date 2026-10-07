"""Twenty read-only reports, with explicit joins and zero-safe aggregates."""

from dataclasses import dataclass

from baxi.application.services import staff_permission
from baxi.db.queries import rows


@dataclass(frozen=True)
class Report:
    title: str
    sql: str
    schema: str = "baxi_users"


REPORTS = [
    Report(
        "درخواست‌ها به تفکیک وضعیت",
        "SELECT state,COUNT(*) AS requests FROM service_requests GROUP BY state ORDER BY state",
    ),
    Report(
        "درآمد سفر به تفکیک سرویس",
        "SELECT r.service_type,COUNT(*) AS trips,SUM(t.cost) AS gross_irr FROM service_acceptances a JOIN service_requests r ON r.id=a.request_id JOIN trip_costs t ON t.request_id=r.id GROUP BY r.service_type ORDER BY r.service_type",
    ),
    Report(
        "درآمد رانندگان",
        "SELECT d.id,d.first_name,d.last_name,COUNT(*) AS trips,SUM(t.cost) AS gross_irr,SUM(COALESCE(p.driver_net_irr,FLOOR(t.cost*0.8))) AS net_irr FROM service_acceptances a JOIN drivers d ON d.id=a.driver_id JOIN trip_costs t ON t.request_id=a.request_id LEFT JOIN trip_pricing p ON p.request_id=a.request_id GROUP BY d.id,d.first_name,d.last_name ORDER BY net_irr DESC,d.id",
    ),
    Report(
        "درخواست‌های ۳۰ روز اخیر",
        "SELECT DATE(request_time) AS day,COUNT(*) AS requests FROM service_requests WHERE request_time>=CURDATE()-INTERVAL 30 DAY GROUP BY DATE(request_time) ORDER BY day",
    ),
    Report(
        "نرخ لغو درخواست‌ها",
        "SELECT COUNT(*) AS total,COALESCE(SUM(state='cancelled'),0) AS cancelled,COALESCE(ROUND(100*SUM(state='cancelled')/NULLIF(COUNT(*),0),2),0) AS cancelled_percent FROM service_requests",
    ),
    Report(
        "هزینهٔ سفر مشتریان",
        "SELECT c.id,c.first_name,c.last_name,COUNT(*) AS trips,SUM(t.cost) AS spent_irr FROM service_acceptances a JOIN service_requests r ON r.id=a.request_id JOIN clients c ON c.id=r.client_id JOIN trip_costs t ON t.request_id=r.id GROUP BY c.id,c.first_name,c.last_name ORDER BY spent_irr DESC,c.id",
    ),
    Report(
        "رانندگان در انتظار بررسی",
        "SELECT id,first_name,last_name,signup_time FROM drivers WHERE verification_status='pending' ORDER BY id",
    ),
    Report(
        "وضعیت تراکنش‌ها",
        "SELECT state,type,COUNT(*) AS transactions,SUM(amount) AS amount_irr FROM transactions GROUP BY state,type ORDER BY state,type",
    ),
    Report(
        "شارژ کیف پول مشتریان",
        "SELECT d.client_id,COUNT(*) AS deposits,SUM(t.amount) AS deposited_irr FROM deposits d JOIN transactions t ON t.tracking_code=d.tracking_code GROUP BY d.client_id ORDER BY d.client_id",
    ),
    Report(
        "برداشت رانندگان",
        "SELECT w.driver_id,COUNT(*) AS withdrawals,SUM(t.amount) AS withdrawn_irr FROM withdrawals w JOIN transactions t ON t.tracking_code=w.tracking_code GROUP BY w.driver_id ORDER BY w.driver_id",
    ),
    Report(
        "ظرفیت ناوگان",
        "SELECT 'baxi' AS service,COUNT(*) AS vehicles,AVG(vehicle_capacity) AS capacity FROM baxi UNION ALL SELECT 'box',COUNT(*),AVG(vehicle_capacity) FROM baxi_box UNION ALL SELECT 'baar',COUNT(*),AVG(vehicle_capacity) FROM baxi_baar",
    ),
    Report(
        "میانگین امتیاز رانندگان",
        "SELECT driver_id,COUNT(driver_rating) AS ratings,AVG(driver_rating) AS average_rating FROM service_acceptances GROUP BY driver_id ORDER BY driver_id",
    ),
    Report(
        "بررسی انطباق سرویس بانوان",
        "SELECT r.id,r.state FROM service_requests r JOIN clients c ON c.id=r.client_id LEFT JOIN drivers d ON d.id=r.assigned_driver_id WHERE r.service_type='women' AND (c.sex<>'F' OR (r.assigned_driver_id IS NOT NULL AND d.sex<>'F')) ORDER BY r.id",
    ),
    Report(
        "مدت سفرهای تکمیل‌شده",
        "SELECT service_type,AVG(TIMESTAMPDIFF(SECOND,started_at,completed_at)) AS average_seconds FROM service_requests WHERE state='completed' GROUP BY service_type ORDER BY service_type",
    ),
    Report(
        "حقوق کارکنان به تفکیک واحد",
        "SELECT department,COUNT(*) AS employees,SUM(salary) AS salary_irr FROM employees GROUP BY department ORDER BY department",
        "baxi_staff",
    ),
    Report(
        "وضعیت گزارش‌های کاربران",
        "SELECT state,COUNT(*) AS reports FROM reports GROUP BY state ORDER BY state",
    ),
    Report(
        "آدرس‌های ذخیره‌شده",
        "SELECT c.id,c.first_name,c.last_name,COUNT(a.address_name) AS saved_addresses FROM clients c LEFT JOIN addresses a ON a.client_id=c.id GROUP BY c.id,c.first_name,c.last_name ORDER BY c.id",
    ),
    Report(
        "درآمد ماهانهٔ ثبت‌شده",
        "SELECT driver_id,month,gross_income,net_income FROM monthly_incomes ORDER BY month DESC,driver_id",
    ),
    Report(
        "درخواست‌های ناتمام هر سرویس",
        "SELECT service_type,COUNT(*) AS active_requests FROM service_requests WHERE state IN ('requested','accepted','in_progress') GROUP BY service_type ORDER BY service_type",
    ),
    Report(
        "زنجیرهٔ معرفی رانندگان",
        """WITH RECURSIVE chain AS (
        SELECT referred_id,referrer_id,1 AS depth,CAST(CONCAT(',',referred_id,',',referrer_id,',') AS CHAR(4096)) AS path FROM referrals
        UNION ALL SELECT c.referred_id,r.referrer_id,c.depth+1,CONCAT(c.path,r.referrer_id,',') FROM chain c JOIN referrals r ON r.referred_id=c.referrer_id
        WHERE c.depth<100 AND LOCATE(CONCAT(',',r.referrer_id,','),c.path)=0)
        SELECT referred_id,referrer_id,depth FROM chain ORDER BY referred_id,depth""",
    ),
]


def run_report(code, report_id):
    staff_permission(code, manager=True)
    if not 1 <= report_id <= len(REPORTS):
        raise ValueError("Unknown report")
    report = REPORTS[report_id - 1]
    return {"title": report.title, "rows": rows(report.sql, schema=report.schema)}
