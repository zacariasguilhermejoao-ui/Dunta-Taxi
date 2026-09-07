const DUNTA_SUPABASE_URL='https://keonvsakkkzxnxxduacz.supabase.co';
const DUNTA_SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlb252c2Fra2t6eG54eGR1YWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUxODQsImV4cCI6MjEwNDE4MTE4NH0.cgiVTH4txAUPwpQozH7AmGergXHIPGpPEFKHU2LBMHg';
const DUNTA_DRIVER_RADIUS_KM=15;
const DUNTA_REQUEST_MAX_AGE_MS=3*60*1000; // ignore requests older than 3 minutes
const DUNTA_COUNTRIES=[["AO","+244"],["PT","+351"],["BR","+55"],["MZ","+258"],["CV","+238"],["US","+1"]];
let selectedRole='passenger',selectedVehicle='any',pendingDestination='';
let duntaSupabase=null,duntaMap=null,duntaMe=null,duntaWatch=null,duntaAccuracy=null;
let duntaDrivers=new Map(),duntaPassengerLocation=null,duntaDriverRecordId=null,duntaLocationTimer=null;
let duntaActiveRide=null,duntaRideChannel=null,duntaIncomingRequest=null,routeLine=null;
let duntaMeMarker=null,duntaPassengerMarker=null,duntaLiveRideTimer=null,duntaBooted=false;
let duntaDestinationCoords=null,duntaDestMarker=null;
