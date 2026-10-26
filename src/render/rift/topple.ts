export const RIGID = 8;
export function fallAngle(angle: number, rigid: boolean) {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return rigid ? a + RIGID : a;
}
export const TOPPLE_PARS = `
uniform sampler2D uBroken;
uniform float uRiftTime;
float riftTopple( inout vec3 p, float tag ) {
	if ( tag < .5 ) return 0.0;
	vec4 b = texelFetch( uBroken, ivec2( int( tag + .5 ), 0 ), 0 );
	if ( b.r <= 0.0 ) return 0.0;
	// Its foot: on the slopes beyond the field a piece stands above zero.
	float foot = texelFetch( uBroken, ivec2( int( tag + .5 ), 1 ), 0 ).r;
	float t = clamp( ( uRiftTime - ( b.r - 1.0 ) ) / 1.15, 0.0, 1.0 );
	float rigid = step( ${RIGID - .5}, b.a ), heading = b.a - rigid * ${RIGID}.0;
	vec2 dir = vec2( sin( heading ), cos( heading ) );
	vec3 q = p - vec3( b.g, foot, b.b );
	float along = dot( q.xz, dir ), up = q.y, ang = t * t * mix( 1.35, 1.5708, rigid );
	float nAlong = along * cos( ang ) + up * sin( ang ), nUp = -along * sin( ang ) + up * cos( ang );
	q.xz += dir * ( nAlong - along );
	q.y = mix( nUp, nUp * mix( .18, .8, rigid ), smoothstep( .72, 1.0, t ) );
	p = vec3( b.g, foot, b.b ) + q;
	p.y = max( p.y, foot + .02 );
	return t;
}
`;
