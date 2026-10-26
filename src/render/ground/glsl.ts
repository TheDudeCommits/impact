export const GROUND_NOISE = `
float groundHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
vec2 groundHash2( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * vec3( .1031, .1030, .0973 ) ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.xx + q.yz ) * q.zy ); }
float groundNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3. - 2. * f );
	return mix( mix( groundHash( i ), groundHash( i + vec2( 1., 0. ) ), u.x ), mix( groundHash( i + vec2( 0., 1. ) ), groundHash( i + vec2( 1., 1. ) ), u.x ), u.y );
}
float groundFbm( vec2 p ) { return groundNoise( p ) * .55 + groundNoise( p * 2.13 + 7.1 ) * .3 + groundNoise( p * 4.37 + 3.7 ) * .15; }
// The field's darker patches, a few metres across, as a multiplier on its
// value: the blades and the ground sheet under them share it.
float groundPatchValue( vec2 p ) { return mix( .72, 1.05, smoothstep( .22, .68, groundNoise( p * .19 + 11.3 ) ) ); }
`;

export const GROUND_WIND = `
uniform vec4 uWind;
vec2 groundWind( vec2 p, float t ) {
	vec2 dir = uWind.xy;
	float along = dot( p, dir );
	float gust = groundNoise( vec2( along - t * uWind.w, dot( p, vec2( -dir.y, dir.x ) ) ) * .09 );
	gust = smoothstep( .3, .85, gust );
	float sway = sin( t * 1.7 + along * .45 + groundNoise( p * .3 ) * 6.283 ) * .35 + sin( t * 3.1 + p.x * 1.3 + p.y * .9 ) * .12;
	return dir * uWind.z * ( .25 + gust * .9 + sway * ( .4 + gust ) );
}
`;
