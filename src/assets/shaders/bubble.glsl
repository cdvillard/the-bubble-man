// ---------- Soap Bubble : spectral thin-film interference ----------
//
// Physics: air / soap-water film (n=1.33) / air — a SYMMETRIC stack, unlike
// oil on asphalt. Both Fresnel coefficients have opposite sign, so as the
// film drains to d→0 the reflectance cancels to ZERO for every wavelength:
// the famous "black film" cap a bubble grows just before it pops.
// Airy multi-bounce reflectance (s+p), 24-λ integration 380–730nm,
// CIE 1931 CMF fit → XYZ → linear sRGB.
// Film thickness: gravity drainage (thick at bottom) + Marangoni marbling.

const float PI = 3.14159265358979;
const float N_AIR  = 1.000;
const float N_FILM = 1.330;                 // soapy water
const vec3  SUN    = normalize(vec3(0.55, 0.45, 0.35));
const vec3  SUNCOL = vec3(1.05, 0.98, 0.90);

/* ---------------- 3D value noise (seam-free on the sphere) ---------------- */
float hash3(vec3 p){
    p = fract(p*0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x*p.y*p.z*(p.x + p.y + p.z));
}
float vnoise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0 - 2.0*f);
    return mix(mix(mix(hash3(i+vec3(0,0,0)), hash3(i+vec3(1,0,0)), f.x),
                   mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
                   mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<4;i++){ v += a*vnoise3(p); p = p*2.07 + 13.1; a *= 0.5; }
    return v;
}

/* ------ signed real Fresnel amplitudes (signs carry the phase flips) ------ */
float frs(float n1,float c1,float n2,float c2){ return (n1*c1 - n2*c2)/(n1*c1 + n2*c2); }
float frp(float n1,float c1,float n2,float c2){ return (n2*c1 - n1*c2)/(n2*c1 + n1*c2); }
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b){ float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
float airyR(float r12, float r23, float delta){
    vec2 e = vec2(cos(delta), sin(delta));
    vec2 r = cdiv(vec2(r12,0.0) + r23*e, vec2(1.0,0.0) + r12*r23*e);
    return dot(r,r);
}
float filmR(float lambda, float d, float c1){
    float s1 = sqrt(max(0.0, 1.0 - c1*c1));
    float s2 = N_AIR*s1/N_FILM;                    // Snell air→film
    float c2 = sqrt(max(0.0, 1.0 - s2*s2));
    /* exit medium is air again: n3 = N_AIR, c3 = c1 by symmetry */
    float delta = 4.0*PI*N_FILM*d*c2/lambda;
    return 0.5*( airyR(frs(N_AIR,c1,N_FILM,c2), frs(N_FILM,c2,N_AIR,c1), delta)
               + airyR(frp(N_AIR,c1,N_FILM,c2), frp(N_FILM,c2,N_AIR,c1), delta) );
}

/* ------- CIE 1931 CMF fit (Wyman/Sloan/Shirley) + XYZ→sRGB ------- */
float g(float x, float mu, float s1, float s2){
    float t = (x-mu) / (x<mu ? s1 : s2);
    return exp(-0.5*t*t);
}
vec3 cmf(float l){
    return vec3(
        1.056*g(l,599.8,37.9,31.0) + 0.362*g(l,442.0,16.0,26.7) - 0.065*g(l,501.1,20.4,26.2),
        0.821*g(l,568.8,46.9,40.5) + 0.286*g(l,530.9,16.3,31.1),
        1.217*g(l,437.0,11.8,36.0) + 0.681*g(l,459.0,26.0,13.8));
}
vec3 xyz2rgb(vec3 c){
    return vec3( 3.2406*c.x - 1.5372*c.y - 0.4986*c.z,
                -0.9689*c.x + 1.8758*c.y + 0.0415*c.z,
                 0.0557*c.x - 0.2040*c.y + 1.0570*c.z);
}
vec3 filmRGB(float d, float c1){
    vec3 XYZ = vec3(0.0); float ysum = 0.0;
    for(int i=0;i<24;i++){
        float l = 380.0 + (350.0/23.0)*float(i);
        vec3 w = cmf(l);
        XYZ  += w * filmR(l, d, c1);
        ysum += w.y;
    }
    return clamp(xyz2rgb(XYZ/ysum), 0.0, 1.0);
}

/* ---------------- environment ---------------- */
vec3 env(vec3 rd){
    float h = rd.y;
    vec3 skyc = mix(vec3(0.70,0.74,0.80), vec3(0.22,0.36,0.62), pow(clamp(h,0.0,1.0), 0.5));
    skyc += 0.10*fbm3(rd*3.0 + vec3(0.0, 0.0, iTime*0.01));            // faint clouds
    float sd = max(dot(rd, SUN), 0.0);
    skyc += SUNCOL * (pow(sd, 900.0)*18.0 + pow(sd, 16.0)*0.20);
    vec3 gnd = mix(vec3(0.16,0.15,0.14), vec3(0.30,0.28,0.26), clamp(-h*3.0,0.0,1.0));
    return mix(gnd, skyc, smoothstep(-0.03, 0.03, h));
}

/* -------- film thickness over the shell (nanometers) -------- */
float thickness(vec3 n, float t){
    /* gravity drainage: liquid pools at the bottom of the shell */
    float down = clamp(0.5 - 0.5*n.y, 0.0, 1.0);

    /* Marangoni marbling: swirl the sample point around y, drift downward */
    vec3 q = n;
    float a = t*0.12 + n.y*1.3;
    q.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * q.xz;
    float sw = fbm3(q*2.8 + vec3(0.0, t*0.10, 0.0)) - 0.5;

    /* cap thickness breathes 15–65nm: the black film grows and recedes */
    float dcap = 40.0 + 25.0*sin(t*0.21);
    float d = dcap
            + 1100.0*pow(down, 1.7)                 // drainage gradient
            + sw * (120.0 + 520.0*down);            // marbling, stronger where thick
    return max(d, 4.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = (fragCoord*2.0 - iResolution.xy) / iResolution.y;
    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vec3(uv, -1.6));
    float t = iTime;

    /* bubble: gentle bob and drift */
    vec3  C   = vec3(0.10*sin(t*0.40), 0.10*sin(t*0.63 + 1.7), -3.2);
    float RAD = 1.15;

    vec3 bg = env(rd);
    vec3 col = bg;

    vec3  oc   = ro - C;
    float b    = dot(oc, rd);
    float disc = b*b - (dot(oc,oc) - RAD*RAD);

    if(disc > 0.0){
        float sq = sqrt(disc);
        float t1 = -b - sq;                          // front shell hit
        float t2 = -b + sq;                          // back shell hit

        /* --- front surface --- */
        vec3 n1 = normalize(ro + rd*t1 - C);
        float c1 = clamp(dot(-rd, n1), 0.02, 1.0);
        vec3 Rf = filmRGB(thickness(n1, t), c1);

        /* --- back surface: a ~500nm shell doesn't bend the ray, so the
               transmitted ray continues STRAIGHT and hits the far side --- */
        vec3 n2 = normalize(ro + rd*t2 - C);
        float c2 = clamp(dot(rd, n2), 0.02, 1.0);    // incidence from inside
        vec3 Rb = filmRGB(thickness(n2, t), c2);

        vec3 bub = env(reflect(rd, n1)) * Rf         // front film mirrors the world
                 + env(reflect(rd, n2)) * Rb * (1.0 - Rf)   // back film, seen through front
                 + bg * (1.0 - Rf) * (1.0 - Rb);     // straight transmission

        /* analytic silhouette anti-aliasing: blend over one pixel footprint */
        float px = 2.0/(iResolution.y*1.6) * t1;     // pixel size in world units at t1
        float edge = smoothstep(RAD, RAD - 2.0*px, length(oc - rd*b));
        col = mix(bg, bub, edge);
    }

    col = 1.0 - exp(-col*1.6);                       // tonemap
    col = pow(col, vec3(1.0/2.2));                   // gamma
    fragColor = vec4(col, 1.0);
}
