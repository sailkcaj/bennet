from pathlib import Path
from functools import lru_cache
import math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

DEMO=Path(__file__).resolve().parent
ROOT=DEMO/'.cache'; ROOT.mkdir(exist_ok=True)
SOURCE=ROOT/'frames'
OUT=DEMO/'Bennet-demo.mp4'
W,H,FPS,DURATION=1920,1080,30,66
BG='#081817'; SURF='#112724'; EDGE='#29433c'; WHITE='#f2f5ed'
MUTED='#a0b7aa'; MINT='#b8eed0'; AMBER='#f2c584'; CORAL='#f6a995'
FONT=next((p for p in [
    '/System/Library/Fonts/Avenir Next.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
] if Path(p).exists()),None)
if FONT is None:
    raise RuntimeError('Install Avenir Next (macOS) or DejaVu Sans (Linux) to render the demo.')
@lru_cache(None)
def font(n,b=False):
    return ImageFont.truetype(FONT,n,index=(2 if b else 7) if FONT.endswith('.ttc') else 0)
def text(d,xy,s,n=24,c=WHITE,b=False): d.text(xy,s,font=font(n,b),fill=c)
def rr(d,box,fill=SURF,r=24,outline=None,width=2):d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)
def circle(d,x,y,r,c):d.ellipse((x-r,y-r,x+r,y+r),fill=c)
def pill(d,x,y,s,c=MINT,bg='#233d32',n=17):
    tw=d.textlength(s,font=font(n,True));rr(d,(x,y,x+tw+30,y+36),bg,18);text(d,(x+15,y+5),s,n,c,True)
def center(d,y,s,n=24,c=WHITE,b=False,x=W/2):text(d,(x-d.textlength(s,font=font(n,b))/2,y),s,n,c,b)
@lru_cache(maxsize=12)
def mask(w,h,r):
    m=Image.new('L',(w,h),0);ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),radius=r,fill=255);return m
def prepare_frames():
    for kind in ['face','wide']:
        folder=SOURCE/kind; folder.mkdir(parents=True,exist_ok=True)
        stamp=folder/'complete'
        if not stamp.exists():
            source=DEMO/'inputs'/f'{kind}.mov'
            if not source.exists():raise FileNotFoundError(source)
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),
                '-an','-vf','fps=30,scale=1104:621','-q:v','3',str(folder/'%04d.jpg')],check=True)
            stamp.touch()
    return {k:sorted((SOURCE/k).glob('*.jpg')) for k in ['face','wide']}
frames=prepare_frames()
@lru_cache(maxsize=300)
def shot(k,i,w,h):return Image.open(frames[k][i]).convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
def ping(n,t):
    q=int(t*FPS)%(2*(n-1));return q if q<n else 2*(n-1)-q
def paste(im,k,idx,x,y,w,h,r=24):im.paste(shot(k,idx,w,h),(x,y),mask(w,h,r))
def brand(d,context,t,c=MINT):
    circle(d,70,67,18,c);circle(d,78,60,17,BG if context!='CHECK-IN ALARM' else '#311411')
    text(d,(102,33),'bennet',49,WHITE,True)
    text(d,(319,56),context,19,MUTED,True)
    pill(d,730 if context=='NEARBY HELPER' else 1477,45,'SIMULATED SCENARIO',AMBER,'#3b3023',17)
    text(d,(1792,49),f'{int(t):02d}s',22,MUTED)
    d.line((48,112,1872,112),fill=EDGE,width=1)
def footer(d,s):text(d,(48,1028),s,18,MUTED)

# Hand-keyframed illustration, following the recorded camera move.
# Coordinates are based on a 533 x 300 preview; no biometric inference is made.
KEYS=np.array([0,50,100,150,200,248])
REGIONS={
 'FOREHEAD':[(105,154),(104,147),(107,153),(65,164),(69,165),(61,162)],
 'CHEEK A':[(182,148),(185,143),(191,147),(213,155),(221,154),(239,147)],
 'CHEEK B':[(141,219),(138,215),(145,220),(141,253),(157,255),(169,257)]}
def track(d,idx,x,y,w,h,alert=False):
    color=CORAL if alert else MINT
    scale=w/533
    for j,(name,positions) in enumerate(REGIONS.items()):
        px=np.interp(idx,KEYS,[p[0] for p in positions]);py=np.interp(idx,KEYS,[p[1] for p in positions])
        cx=x+px*scale;cy=y+py*h/300
        size=(19+idx/248*8)*scale
        left,top=cx-size/2,cy-size/2
        d.rectangle((left,top,left+size,top+size),outline=color,width=2)
        ln=11
        for xx,yy,dx,dy in [(left,top,1,1),(left+size,top,-1,1),(left,top+size,1,-1),(left+size,top+size,-1,-1)]:
            d.line([(xx,yy+dy*ln),(xx,yy),(xx+dx*ln,yy)],fill=color,width=4)
        # Small labels remain outside the sampled patch.
        labelx=left+size+8 if j!=2 else left-size*.3
        labely=top-25 if j!=2 else top+size+7
        tw=d.textlength(name,font=font(15,True))
        rr(d,(labelx-6,labely-2,labelx+tw+6,labely+23),'#102a21',5)
        text(d,(labelx,labely),name,15,color,True)

def waveform(d,box,t,kind,abnormal=False):
    x,y,w,h=box
    for j in range(5):d.line((x,y+j*h/4,x+w,y+j*h/4),fill='#294237',width=1)
    for j in range(9):d.line((x+j*w/8,y,x+j*w/8,y+h),fill='#20372d',width=1)
    u=np.linspace(t-7,t,560)
    if abnormal:
        v=.5+.22*np.sin(u*14+2*np.sin(u*2))+.16*np.sin(u*31)+.07*np.sin(u*73)
        if kind=='breath':v=.5+.22*np.sin(u*4+np.sin(u*1.6))+.13*np.sin(u*15)
        color=CORAL
    elif kind=='pulse':
        phase=(u*64/60)%1
        v=.83-.66*np.exp(-((phase-.22)/.10)**2)-.16*np.exp(-((phase-.50)/.11)**2)
        color=MINT
    else:v=.5-.32*np.sin(u*2*math.pi*14/60);color=AMBER
    pts=[(x+i*w/(len(v)-1),y+float(q)*h) for i,q in enumerate(v)]
    d.line(pts,fill=color,width=3,joint='curve');circle(d,*pts[-1],5,color)

def monitor(t):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im);ab=t>=8
    brand(d,'BEDSIDE OVERVIEW',t)
    text(d,(48,135),'Sleep session',52,WHITE,True)
    text(d,(50,205),'Face pulse + breathing, together.',24,MUTED)
    pill(d,1460,174,'TEST EVENT TRIGGERED' if ab else 'TRACKING PREVIEW',CORAL if ab else MINT,'#472920' if ab else '#233d32')
    idx=ping(len(frames['face']),t)
    paste(im,'face',idx,48,267,1140,641,26);d=ImageDraw.Draw(im)
    track(d,idx,48,267,1140,641,ab)
    pill(d,70,288,'ILLUSTRATIVE PULSE REGIONS',MINT,'#102a21',16)
    # Both funny clips are present, without using either original audio track.
    wi=ping(min(len(frames['wide']),150),t)
    rr(d,(836,686,1172,892),'#0c211b',18)
    paste(im,'wide',wi,844,694,320,180,13);d=ImageDraw.Draw(im)
    pill(d,862,834,'WIDE VIEW',WHITE,'#142c24',13)
    rr(d,(48,931,1188,995),SURF,18,EDGE)
    text(d,(70,948),'3 sample regions',22,MINT,True)
    text(d,(369,950),'Boxes follow the recorded camera movement',20,MUTED)
    for y,title,num,unit,kind in [(267,'Face pulse','64','BPM','pulse'),(647,'Breathing','14','/ MIN','breath')]:
        h=348 if kind=='pulse' else 348
        rr(d,(1220,y,1872,y+h),SURF,26,CORAL if ab else EDGE)
        text(d,(1248,y+20),title,29,WHITE,True)
        text(d,(1248,y+66),'—' if ab else num,91,CORAL if ab else (MINT if kind=='pulse' else AMBER),True)
        text(d,(1401,y+118),'UNSTABLE' if ab else unit,23,CORAL if ab else MUTED,True)
        waveform(d,(1250,y+201,592,86),t,kind,ab)
        text(d,(1248,y+303),'Simulated irregular trace' if ab else 'Simulated optical waveform' if kind=='pulse' else 'Simulated respiratory waveform',19,MUTED)
    footer(d,'Recorded clips are muted. Tracking, readings and alert events are illustrative.')
    return im

def alarm(t):
    im=Image.new('RGB',(W,H),'#311411');d=ImageDraw.Draw(im)
    # A slow, smooth glow rather than a flashing screen.
    glow=int(40+14*(1+math.sin((t-12)*math.pi))/2)
    d.rounded_rectangle((14,14,1906,1066),radius=30,outline=(120+glow,66,50),width=4)
    brand(d,'CHECK-IN ALARM',t,CORAL)
    pill(d,792,145,"SLEEPER’S PHONE",CORAL,'#54271e',20)
    center(d,210,'Are you okay?',68,WHITE,True)
    center(d,300,'Your check-in alarm is sounding.',27,'#dcb6a9')
    remain=max(0,math.ceil(42-t));fraction=max(0,(42-t)/30)
    cx,cy=960,540;r=164
    d.ellipse((cx-r,cy-r,cx+r,cy+r),outline='#63382c',width=9)
    if fraction>0:d.arc((cx-r,cy-r,cx+r,cy+r),-90,-90+360*fraction,fill=AMBER,width=9)
    center(d,395,f'{remain:02d}',188,WHITE,True)
    center(d,601,'SECONDS TO CANCEL',20,'#e7c6b6',True)
    center(d,738,'No response? Bennet will notify the nearest available helper.',27,'#e7c6b6')
    rr(d,(500,817,1420,921),MINT,28)
    center(d,842,"I’m okay — cancel alert",36,'#102b1d',True)
    center(d,951,'Alarm and notification flow shown in demo mode.',20,'#c79d8f')
    return im

def phone_shell(d,t):
    rr(d,(1060,36,1696,1040),'#020806',77,'#52665a',3)
    rr(d,(1076,52,1680,1024),'#dfe9df',64)
    rr(d,(1281,66,1475,98),'#020806',20)
    text(d,(1116,72),'15:42',19,'#193d2c',True)
    # Reception + battery, solely a drawn phone mock-up.
    for j in range(4):d.rectangle((1572+j*6,87-j*3,1575+j*6,93),fill='#294c39')
    rr(d,(1610,78,1644,93),None,4,'#294c39',2);d.rectangle((1614,82,1637,89),fill='#294c39')
    rr(d,(1290,1000,1466,1006),'#163d2a',3)

def arrow(d,a,b,c=MINT,width=7):
    d.line((a,b),fill=c,width=width)
    ang=math.atan2(b[1]-a[1],b[0]-a[0]);q=15
    pts=[b,(b[0]-q*math.cos(ang-.55),b[1]-q*math.sin(ang-.55)),(b[0]-q*math.cos(ang+.55),b[1]-q*math.sin(ang+.55))]
    d.polygon(pts,fill=c)

def helper(t):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    brand(d,'NEARBY HELPER',t)
    text(d,(80,213),'No response.',64,WHITE,True)
    text(d,(80,292),'Someone nearby',58,WHITE,True)
    text(d,(80,368),'gets the alert.',58,WHITE,True)
    pill(d,82,484,'NEAREST AVAILABLE · OPTED IN',MINT,'#233d32',19)
    text(d,(80,559),'30 m',98,MINT,True)
    text(d,(82,687),'away in this example',27,MUTED)
    if t<47:
        text(d,(82,790),'01  Notification received',26,WHITE,True)
        text(d,(82,838),'The helper can open the request.',23,MUTED)
    else:
        text(d,(82,790),'02  Route opened',26,WHITE,True)
        text(d,(82,838),'A short route to check on the person.',23,MUTED)
    phone_shell(d,t)
    if t<47:
        center(d,183,'15:42',95,'#214a32',True,x=1378)
        center(d,307,'Sunday, 15 November',23,'#4e6b56',False,x=1378)
        rr(d,(1100,407,1656,749),'#f4f7f0',28,'#bdcec0')
        circle(d,1134,442,13,'#286647')
        text(d,(1161,425),'BENNET',19,'#31523e',True)
        text(d,(1589,428),'now',17,'#6b8371')
        text(d,(1125,479),'Someone needs help',30,'#183f2b',True)
        text(d,(1125,526),'30 m away',27,'#286647',True)
        text(d,(1125,576),'No response to their Bennet alarm.',21,'#496853')
        text(d,(1125,612),'Please go and check on them.',21,'#496853')
        rr(d,(1125,665,1631,724),'#205b3e',16)
        center(d,675,'View route',24,'#f3f6ee',True,x=1378)
        center(d,920,'SIMULATED NOTIFICATION',17,'#5d7c65',True,x=1378)
    else:
        text(d,(1110,123),'bennet',32,'#183f2b',True)
        text(d,(1110,177),'Nearby check-in',30,'#183f2b',True)
        pill(d,1110,228,'30 M AWAY', '#20563b','#c4dbca',18)
        # Draw a fictional local route. No real address or live GPS data is used.
        mapbox=(1100,292,1656,731);rr(d,mapbox,'#cddccc',24)
        for box in [(1114,310,1265,428),(1450,310,1640,428),(1114,544,1265,712),(1450,544,1640,712)]:
            rr(d,box,'#b5cbb6',13,'#a3bfa7',1)
        d.line((1102,486,1654,486),fill='#f6f7ef',width=68)
        d.line((1355,294,1355,729),fill='#f6f7ef',width=68)
        for x,y in [(1150,365),(1210,594),(1510,365),(1574,628)]:
            circle(d,x,y,18,'#92b494');circle(d,x-3,y-4,12,'#a1bea1')
        text(d,(1130,676),'COURTYARD',14,'#66826a',True)
        text(d,(1449,442),'WALKWAY',13,'#66826a',True)
        path=[(1355,658),(1355,486),(1532,486)]
        d.line(path,fill='#287550',width=12,joint='curve')
        arrow(d,(1355,587),(1355,561),'#e7f3e6',3)
        arrow(d,(1420,486),(1446,486),'#e7f3e6',3)
        circle(d,1355,658,17,'#2f7e5a');circle(d,1355,658,7,'#f7faf2')
        circle(d,1532,486,20,'#be6748');text(d,(1525,470),'!',24,'white',True)
        rr(d,(1298,684,1415,714),'#f6f8f1',8);text(d,(1336,687),'YOU',15,'#214c35',True)
        rr(d,(1453,519,1624,551),'#f6f8f1',8);text(d,(1465,523),'BENNET USER',15,'#6a4335',True)
        rr(d,(1100,753,1656,904),'#f4f7f0',22)
        arrow(d,(1135,813),(1135,781),'#205b3e',5)
        text(d,(1170,775),'Follow the walkway',24,'#193f2b',True)
        text(d,(1170,818),'Turn right into the courtyard.',20,'#52735c')
        rr(d,(1110,927,1646,984),'#205b3e',16)
        center(d,936,'On my way',24,'#f3f6ee',True,x=1378)
    footer(d,'Demo flow only. Notification, distance and map are simulated; no real person is contacted.')
    return im

def payment(t):
    im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    brand(d,'CHECK-IN COMPLETE',t)
    rr(d,(420,145,1500,993),'#102923',36,'#37594a',2)
    # This is the staged scenario's closing payment prompt, not a live checkout.
    elapsed=max(0,t-56)
    radius=56+min(1,elapsed/.6)*8
    circle(d,960,253,radius,'#203e30')
    circle(d,960,253,43,MINT)
    d.line([(940,252),(954,266),(981,237)],fill='#173a29',width=7,joint='curve')
    center(d,336,'You were saved',72,WHITE,True)
    center(d,424,'by Bennet.',72,MINT,True)
    center(d,532,'A nearby helper reached you.',26,MUTED)
    rr(d,(540,605,1380,931),'#17352b',24,'#365447',1)
    text(d,(577,632),'ONE-TIME PAYMENT',18,MUTED,True)
    text(d,(577,670),'$20',86,WHITE,True)
    text(d,(766,725),'USD',22,MUTED,True)
    text(d,(1082,663),'Checkout with',19,MUTED)
    text(d,(1134,692),'whop',42,WHITE,True)
    rr(d,(576,806,1344,896),'#ff6243',20)
    center(d,827,'Pay $20 with Whop',31,'#ffffff',True)
    arrow(d,(1284,851),(1305,851),'#ffffff',3)
    footer(d,'SIMULATED RESCUE · Payment screen preview only. No medical diagnosis or live transaction.')
    return im

def frame(t):
    return monitor(t) if t<12 else alarm(t) if t<42 else helper(t) if t<56 else payment(t)

def make_audio():
    sr=48000
    a=np.zeros(sr*DURATION,dtype=np.float32)
    def tone(start,duration,freq,gain):
        n=int(sr*duration);tt=np.arange(n)/sr
        fade=min(int(.012*sr),n//2);env=np.ones(n)
        env[:fade]=np.linspace(0,1,fade);env[-fade:]=np.linspace(1,0,fade)
        signal=(np.sin(2*np.pi*freq*tt)+.2*np.sin(2*np.pi*freq*2*tt))/1.2
        at=int(start*sr);a[at:at+n]+=gain*signal*env
    for sec in range(12,42):
        tone(sec,.18,880,.48);tone(sec+.27,.18,880,.48)
    tone(42.12,.16,1046.5,.23);tone(42.32,.23,1318.5,.23)
    # Fresh, generated alarm only; original video audio is never read.
    assert np.max(np.abs(a))<1
    with wave.open(str(ROOT/'alarm.wav'),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes((a*32767).astype('<i2').tobytes())

if __name__=='__main__':
    for t in [2,7,10,12,27,41,44,50,56,60,65]:frame(t).save(ROOT/f'preview-{t}.png')
    if '--preview' in sys.argv:sys.exit(0)
    make_audio()
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(ROOT/'alarm.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','4','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',str(DURATION),'-movflags','+faststart',str(OUT)]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for n in range(FPS*DURATION):
            p.stdin.write(frame(n/FPS).tobytes())
            if n%150==0:print(f'Rendered {n/FPS:.0f}/{DURATION}s',flush=True)
        p.stdin.close();rc=p.wait()
        if rc:raise RuntimeError(f'ffmpeg exited {rc}')
    except BaseException:p.kill();raise
    print(str(OUT),OUT.stat().st_size,flush=True)
