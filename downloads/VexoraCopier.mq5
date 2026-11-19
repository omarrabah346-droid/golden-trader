//+------------------------------------------------------------------+
//|  VEXORA Copier v1.0 — ناسخ صفقات منصة فيكسورا                      |
//|  يشتغل على MT5 مال المتدرب. ما يحتاج كلمة سر الحساب.               |
//|  الإعدادات (المخاطرة، اللوت، عدد الصفقات...) تجي من صفحة الناسخ.   |
//|                                                                    |
//|  قبل التشغيل:                                                      |
//|  Tools > Options > Expert Advisors > Allow WebRequest for listed URL |
//|  وضيف:  https://rczvkpzxkwxzoivyiblo.supabase.co                   |
//+------------------------------------------------------------------+
#property copyright   "VEXORA · albashafx.com"
#property link        "https://albashafx.com/app.html#copier"
#property version     "1.10"
#property description "VEXORA Copier: ينسخ صفقات منصة فيكسورا لحسابك بالإعدادات اللي تحددها بالموقع."

#include <Trade/Trade.mqh>

input string InpToken    = "";      // رمز البوت (من صفحة الناسخ بالموقع)
input string InpSuffix   = "";      // لاحقة الرموز عند الوسيط إن وجدت (مثل .m)
// ثابتة ومخفية عن المتدرب (الإعدادات الحقيقية تجي من الموقع)
const int    InpPollSec  = 10;
const int    InpMagic    = 770077;
const int    InpSlippage = 30;

const string API_URL = "https://rczvkpzxkwxzoivyiblo.supabase.co";
const string API_KEY = "sb_publishable_S4Huon2QXOIltvxoFIDdXQ_h79LR245"; // مفتاح عام (نفس الموجود بالموقع)
const string EA_VER  = "1.1";

CTrade   g_trade;
string   g_events[];          // أحداث بانتظار الإرسال (JSON)
string   g_status  = "يبدأ...";
string   g_last    = "";
datetime g_lastOk  = 0;
bool     g_webWarn = false;

//+------------------------------------------------------------------+
string JsonEsc(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\t", " ");
   return s;
  }

string Num(double v, int d = 8)
  {
   string s = DoubleToString(v, d);
   // نشيل الأصفار الزايدة
   if(StringFind(s, ".") >= 0)
     {
      while(StringLen(s) > 1 && StringSubstr(s, StringLen(s) - 1) == "0") s = StringSubstr(s, 0, StringLen(s) - 1);
      if(StringSubstr(s, StringLen(s) - 1) == ".") s = StringSubstr(s, 0, StringLen(s) - 1);
     }
   return s;
  }

// POST لدالة RPC بالسيرفر
int Rpc(string fn, string body, string &resp)
  {
   char data[], res[];
   string rh;
   int n = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(n > 0) ArrayResize(data, n - 1); // بدون حرف النهاية
   string headers = "Content-Type: application/json\r\napikey: " + API_KEY + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", API_URL + "/rest/v1/rpc/" + fn, headers, 10000, data, res, rh);
   if(code == -1)
     {
      int err = GetLastError();
      if(err == 4014 && !g_webWarn)
        {
         g_webWarn = true;
         Alert("VEXORA Copier: لازم تضيف الرابط ", API_URL, " بقائمة Allow WebRequest (Tools > Options > Expert Advisors)");
        }
      resp = "WebRequest error " + IntegerToString(err);
      return -1;
     }
   resp = CharArrayToString(res, 0, WHOLE_ARRAY, CP_UTF8);
   return code;
  }

// الرد نص JSON بين علامتي تنصيص
string Unquote(string s)
  {
   StringTrimLeft(s); StringTrimRight(s);
   if(StringLen(s) >= 2 && StringGetCharacter(s, 0) == '"') s = StringSubstr(s, 1, StringLen(s) - 2);
   StringReplace(s, "\\n", "\n");
   StringReplace(s, "\\\"", "\"");
   StringReplace(s, "\\\\", "\\");
   return s;
  }

void AddEvent(string kind, string sid, string sym, string side, double lot, double price, double pnl, string ticket, string reason)
  {
   string e = "{\"kind\":\"" + kind + "\"";
   if(sid != "")    e += ",\"signal_id\":\"" + JsonEsc(sid) + "\"";
   if(sym != "")    e += ",\"sym\":\"" + JsonEsc(sym) + "\"";
   if(side != "")   e += ",\"side\":\"" + side + "\"";
   if(lot > 0)      e += ",\"lot\":" + Num(lot, 2);
   if(price > 0)    e += ",\"price\":" + Num(price);
   if(kind == "close") e += ",\"pnl\":" + Num(pnl, 2);
   if(ticket != "") e += ",\"ticket\":\"" + ticket + "\"";
   if(reason != "") e += ",\"reason\":\"" + JsonEsc(reason) + "\"";
   e += "}";
   int k = ArraySize(g_events);
   if(k >= 200) return;
   ArrayResize(g_events, k + 1);
   g_events[k] = e;
  }

void FlushEvents()
  {
   int k = ArraySize(g_events);
   if(k == 0) return;
   int m = (int)MathMin(k, 50);
   string arr = "[";
   for(int i = 0; i < m; i++) arr += (i ? "," : "") + g_events[i];
   arr += "]";
   string body = "{\"tok\":\"" + JsonEsc(InpToken) + "\",\"acct\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",\"evs\":" + arr + "}";
   string resp;
   int code = Rpc("copier_report", body, resp);
   if(code == 200)
     {
      int rest = k - m;
      for(int i = 0; i < rest; i++) g_events[i] = g_events[i + m];
      ArrayResize(g_events, rest);
     }
   else Print("VEXORA Copier: report failed ", code, " ", resp);
  }

//+------------------------------------------------------------------+
string CommentOf(string sid)
  {
   string c = "VX " + sid;
   return StringLen(c) > 31 ? StringSubstr(c, 0, 31) : c;
  }

// الصفقة انفتحت قبل؟ (مفتوحة، أو أمر معلق، أو بسجل آخر 3 أيام)
bool AlreadyDone(string cmt)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
      if(PositionGetTicket(i) > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagic && PositionGetString(POSITION_COMMENT) == cmt) return true;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
      if(OrderGetTicket(i) > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagic && OrderGetString(ORDER_COMMENT) == cmt) return true;
   if(HistorySelect(TimeCurrent() - 3 * 86400, TimeCurrent() + 3600))
     {
      for(int i = HistoryOrdersTotal() - 1; i >= 0; i--)
        {
         ulong t = HistoryOrderGetTicket(i);
         if(t > 0 && HistoryOrderGetInteger(t, ORDER_MAGIC) == InpMagic && HistoryOrderGetString(t, ORDER_COMMENT) == cmt) return true;
        }
     }
   return false;
  }

int CountMine()
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
      if(PositionGetTicket(i) > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagic) n++;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
      if(OrderGetTicket(i) > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagic) n++;
   return n;
  }

void CloseAll()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionGetInteger(POSITION_MAGIC) == InpMagic) g_trade.PositionClose(t);
     }
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong t = OrderGetTicket(i);
      if(t > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagic) g_trade.OrderDelete(t);
     }
   Print("VEXORA Copier: انسكرت كل صفقات الناسخ بطلب من الموقع");
  }

double NormLot(string sym, double lots)
  {
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   double mx   = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   if(step <= 0) step = 0.01;
   lots = MathFloor(lots / step + 1e-9) * step;
   if(lots > mx) lots = mx;
   return NormalizeDouble(lots, 2);
  }

bool Transient(uint rc)
  {
   return rc == TRADE_RETCODE_REQUOTE || rc == TRADE_RETCODE_PRICE_CHANGED || rc == TRADE_RETCODE_PRICE_OFF ||
          rc == TRADE_RETCODE_CONNECTION || rc == TRADE_RETCODE_TIMEOUT || rc == TRADE_RETCODE_TOO_MANY_REQUESTS || rc == TRADE_RETCODE_MARKET_CLOSED;
  }

// تنفيذ صفقة وحدة. ترجع true إذا انفتحت (أو تقرر تجاوزها نهائياً)
bool OpenOne(string sid, string sym, bool buy, bool asMarket, double pend, double lots, double sl, double tp, string cmt)
  {
   int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, dg); tp = NormalizeDouble(tp, dg); pend = NormalizeDouble(pend, dg);
   g_trade.SetTypeFillingBySymbol(sym);
   bool ok;
   if(asMarket) ok = buy ? g_trade.Buy(lots, sym, 0, sl, tp, cmt) : g_trade.Sell(lots, sym, 0, sl, tp, cmt);
   else
     {
      datetime exp = TimeCurrent() + 4 * 3600;
      ok = buy ? g_trade.BuyLimit(lots, pend, sym, sl, tp, ORDER_TIME_SPECIFIED, exp, cmt)
               : g_trade.SellLimit(lots, pend, sym, sl, tp, ORDER_TIME_SPECIFIED, exp, cmt);
      if(!ok && g_trade.ResultRetcode() == TRADE_RETCODE_INVALID_EXPIRATION)
         ok = buy ? g_trade.BuyLimit(lots, pend, sym, sl, tp, ORDER_TIME_GTC, 0, cmt)
                  : g_trade.SellLimit(lots, pend, sym, sl, tp, ORDER_TIME_GTC, 0, cmt);
     }
   uint rc = g_trade.ResultRetcode();
   if(ok && (rc == TRADE_RETCODE_DONE || rc == TRADE_RETCODE_PLACED || rc == TRADE_RETCODE_DONE_PARTIAL))
     {
      double px = asMarket ? g_trade.ResultPrice() : pend;
      AddEvent("open", sid, sym, buy ? "buy" : "sell", lots, px, 0, IntegerToString((long)g_trade.ResultOrder()), asMarket ? "" : "LIMIT");
      Print("VEXORA Copier: ", buy ? "BUY " : "SELL ", sym, " ", Num(lots, 2), asMarket ? " market" : " limit @" + Num(pend));
      return true;
     }
   if(Transient(rc)) { Print("VEXORA Copier: retry later ", rc, " ", g_trade.ResultRetcodeDescription()); return false; }
   AddEvent("skip", sid, sym, buy ? "buy" : "sell", lots, 0, 0, "", "ERR " + IntegerToString((int)rc) + " " + g_trade.ResultRetcodeDescription());
   return true;
  }

void Skip(string sid, string sym, string side, string why)
  {
   AddEvent("skip", sid, sym, side, 0, 0, 0, "", why);
   Print("VEXORA Copier: skip ", sid, " - ", why);
  }

// معالجة صفقة من المنصة
// SIG|id|bsym|side|type|entry|lo|hi|sl|tp1|tp2|tp3
bool HandleSignal(string &p[], double risk, string lotMode, double fixLot, string tpMode)
  {
   string sid = p[1], sym = p[2] + InpSuffix, side = p[3], typ = p[4];
   double entry = StringToDouble(p[5]), lo = StringToDouble(p[6]), hi = StringToDouble(p[7]), sl = StringToDouble(p[8]);
   double tps[3]; tps[0] = StringToDouble(p[9]); tps[1] = StringToDouble(p[10]); tps[2] = StringToDouble(p[11]);
   bool buy = side == "buy";
   string cmt = CommentOf(sid);
   if(AlreadyDone(cmt)) { AddEvent("skip", sid, sym, side, 0, 0, 0, "", "ALREADY_OPEN"); return true; }
   if(!SymbolSelect(sym, true)) { Skip(sid, sym, side, "SYMBOL_NOT_FOUND " + sym); return true; }
   if(!(bool)SymbolInfoInteger(sym, SYMBOL_TRADE_MODE)) { Skip(sid, sym, side, "TRADE_DISABLED"); return true; }
   MqlTick tk;
   if(!SymbolInfoTick(sym, tk) || tk.ask <= 0) return false; // نجرب بعدين
   double px = buy ? tk.ask : tk.bid;
   if(sl <= 0 || (buy && sl >= px) || (!buy && sl <= px)) { Skip(sid, sym, side, "PRICE_PAST_SL"); return true; }

   // سوق لو معلق؟
   bool asMarket = true; double pend = 0;
   if(typ != "market" && lo > 0 && hi > 0)
     {
      if(buy && px > hi && entry > 0 && entry < px)       { asMarket = false; pend = entry; }
      else if(!buy && px < lo && entry > 0 && entry > px) { asMarket = false; pend = entry; }
     }
   double ref = asMarket ? px : pend;
   double dist = MathAbs(ref - sl);
   if(dist <= 0) { Skip(sid, sym, side, "BAD_SL"); return true; }

   // اللوت
   double minL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), lots;
   if(lotMode == "fixed") lots = NormLot(sym, fixLot);
   else
     {
      double tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE_LOSS);
      if(tv <= 0) tv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      if(tv <= 0 || ts <= 0) { Skip(sid, sym, side, "NO_TICK_VALUE"); return true; }
      double money = AccountInfoDouble(ACCOUNT_BALANCE) * risk / 100.0;
      lots = NormLot(sym, money / (dist / ts * tv));
     }
   if(lots < minL) { Skip(sid, sym, side, "LOT_TOO_SMALL (المخاطرة أقل من أصغر لوت)"); return true; }

   // الهامش
   double margin = 0;
   if(OrderCalcMargin(buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, sym, lots, px, margin) && margin > AccountInfoDouble(ACCOUNT_MARGIN_FREE))
     { Skip(sid, sym, side, "NO_MARGIN"); return true; }

   // الأهداف
   if(tpMode == "split")
     {
      double part = NormLot(sym, lots / 3.0);
      if(part >= minL)
        {
         bool all = true;
         for(int k = 0; k < 3; k++)
           {
            string c = StringLen(cmt) <= 29 ? cmt + "#" + IntegerToString(k + 1) : StringSubstr(cmt, 0, 29) + "#" + IntegerToString(k + 1);
            if(tps[k] <= 0) continue;
            all = OpenOne(k == 0 ? sid : "", sym, buy, asMarket, pend, part, sl, tps[k], k == 0 ? cmt : c) && all;
           }
         return all;
        }
      tpMode = "tp2";
     }
   int idx = tpMode == "tp1" ? 0 : tpMode == "tp3" ? 2 : 1;
   double tp = tps[idx] > 0 ? tps[idx] : tps[0];
   return OpenOne(sid, sym, buy, asMarket, pend, lots, sl, tp, cmt);
  }

//+------------------------------------------------------------------+
void Poll()
  {
   string info = "{\"balance\":" + Num(AccountInfoDouble(ACCOUNT_BALANCE), 2) +
                 ",\"equity\":" + Num(AccountInfoDouble(ACCOUNT_EQUITY), 2) +
                 ",\"currency\":\"" + JsonEsc(AccountInfoString(ACCOUNT_CURRENCY)) + "\"" +
                 ",\"server\":\"" + JsonEsc(AccountInfoString(ACCOUNT_SERVER)) + "\"" +
                 ",\"name\":\"" + JsonEsc(AccountInfoString(ACCOUNT_NAME)) + "\"" +
                 ",\"demo\":" + (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO ? "true" : "false") +
                 ",\"ver\":\"" + EA_VER + "\"}";
   string body = "{\"tok\":\"" + JsonEsc(InpToken) + "\",\"acct\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",\"info\":" + info + "}";
   string resp;
   int code = Rpc("copier_pull_txt", body, resp);
   if(code != 200) { g_status = "[!] ما گدر يتصل بالموقع (" + IntegerToString(code) + ")"; Print("VEXORA Copier: ", code, " ", resp); return; }
   string txt = Unquote(resp);
   string lines[];
   int nl = StringSplit(txt, '\n', lines);
   if(nl < 1) return;
   string h[];
   int hn = StringSplit(lines[0], '|', h);
   if(hn >= 2 && h[0] == "ERR") { g_status = "[X] " + h[1] + (h[1] == "BAD_TOKEN" ? " - تأكد من الرمز ورقم الحساب" : ""); return; }
   if(hn < 10 || h[0] != "OK") { g_status = "[!] رد غير متوقع"; return; }
   g_lastOk = TimeCurrent();
   bool run = h[1] == "1";
   string why = h[2], cmd = h[3];
   int maxOpen = (int)StringToInteger(h[4]), left = (int)StringToInteger(h[5]);
   double risk = StringToDouble(h[6]), lot = StringToDouble(h[8]);
   string lotMode = h[7], tpMode = h[9];
   if(cmd == "close_all") CloseAll();
   if(!run) { g_status = "[II] متوقف: " + why; return; }
   g_status = "[>] شغّال | مخاطرة " + Num(risk, 2) + "% | باقي اليوم " + IntegerToString(left);
   for(int i = 1; i < nl && left > 0; i++)
     {
      string p[];
      if(StringSplit(lines[i], '|', p) < 12 || p[0] != "SIG") continue;
      if(CountMine() >= maxOpen) { g_status += " | وصل أقصى صفقات مفتوحة"; break; }
      if(HandleSignal(p, risk, lotMode, lot, tpMode)) left--;
     }
  }

//+------------------------------------------------------------------+
bool IsInfinox()
  {
   string c = AccountInfoString(ACCOUNT_COMPANY) + " " + AccountInfoString(ACCOUNT_SERVER);
   StringToLower(c);
   return StringFind(c, "infinox") >= 0;
  }

int OnInit()
  {
   if(!IsInfinox())
     {
      Alert("VEXORA Copier: البوت يشتغل بس على حسابات INFINOX المفتوحة من رابط فيكسورا");
      return INIT_FAILED;
     }
   if(StringLen(InpToken) < 20)
     {
      Alert("VEXORA Copier: حط رمز البوت من صفحة الناسخ بالموقع (InpToken)");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(InpSlippage);
   g_trade.SetAsyncMode(false);
   EventSetTimer((int)MathMax(5, InpPollSec));
   Poll(); FlushEvents(); ShowStatus();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   FlushEvents();
   Comment("");
  }

void OnTimer()
  {
   if(!IsInfinox()) { g_status = "[X] الحساب مو INFINOX"; ShowStatus(); return; }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      g_status = "[!] زر Algo Trading مطفي بـ MT5";
   else Poll();
   FlushEvents();
   ShowStatus();
  }

// نبلّغ الموقع لما تنسكر صفقة من الناسخ (هدف، وقف، أو يدوي)
void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &req, const MqlTradeResult &res)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD || trans.deal == 0) return;
   if(!HistoryDealSelect(trans.deal)) return;
   if(HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != InpMagic) return;
   long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY) return;
   double pnl = HistoryDealGetDouble(trans.deal, DEAL_PROFIT) + HistoryDealGetDouble(trans.deal, DEAL_SWAP) + HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);
   long rs = HistoryDealGetInteger(trans.deal, DEAL_REASON);
   string why = rs == DEAL_REASON_TP ? "TP" : rs == DEAL_REASON_SL ? "SL" : rs == DEAL_REASON_SO ? "STOP_OUT" : rs == DEAL_REASON_EXPERT ? "COPIER" : "MANUAL";
   AddEvent("close", "", HistoryDealGetString(trans.deal, DEAL_SYMBOL), "", HistoryDealGetDouble(trans.deal, DEAL_VOLUME),
            HistoryDealGetDouble(trans.deal, DEAL_PRICE), pnl, IntegerToString(HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID)), why + " #" + IntegerToString((long)trans.deal));
  }

void ShowStatus()
  {
   Comment("VEXORA Copier v", EA_VER, "\n",
           g_status, "\n",
           "آخر اتصال: ", g_lastOk > 0 ? TimeToString(g_lastOk, TIME_SECONDS) : "—", "\n",
           "صفقات الناسخ المفتوحة: ", CountMine(), (ArraySize(g_events) ? "\nبانتظار الإرسال: " + IntegerToString(ArraySize(g_events)) : ""));
  }
//+------------------------------------------------------------------+
