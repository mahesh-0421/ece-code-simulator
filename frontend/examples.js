/* =========================================================
   EXAMPLE TEMPLATES
   Keys must match the <option value="..."> entries in index.html
   and the loadSelectedExample('...') buttons.
   language: 'verilog' | 'matlab'
   ========================================================= */

window.EXAMPLES = {

/* ---------------------- VERILOG ---------------------- */

v_and: {
    language: 'verilog',
    code: `module and_gate(input a, input b, output y);
    assign y = a & b;
endmodule

module tb;
    reg a, b;
    wire y;

    and_gate uut(.a(a), .b(b), .y(y));

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t a=%b b=%b y=%b", $time, a, b, y);

        a = 0; b = 0; #10;
        a = 0; b = 1; #10;
        a = 1; b = 0; #10;
        a = 1; b = 1; #10;
        $finish;
    end
endmodule`
},

v_or: {
    language: 'verilog',
    code: `module or_gate(input a, input b, output y);
    assign y = a | b;
endmodule

module tb;
    reg a, b;
    wire y;

    or_gate uut(.a(a), .b(b), .y(y));

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t a=%b b=%b y=%b", $time, a, b, y);

        a = 0; b = 0; #10;
        a = 0; b = 1; #10;
        a = 1; b = 0; #10;
        a = 1; b = 1; #10;
        $finish;
    end
endmodule`
},

v_half_adder: {
    language: 'verilog',
    code: `module half_adder(input a, input b, output sum, output carry);
    assign sum   = a ^ b;
    assign carry = a & b;
endmodule

module tb;
    reg a, b;
    wire sum, carry;

    half_adder uut(.a(a), .b(b), .sum(sum), .carry(carry));

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t a=%b b=%b sum=%b carry=%b", $time, a, b, sum, carry);

        a = 0; b = 0; #10;
        a = 0; b = 1; #10;
        a = 1; b = 0; #10;
        a = 1; b = 1; #10;
        $finish;
    end
endmodule`
},

v_full_adder: {
    language: 'verilog',
    code: `module full_adder(input a, input b, input cin, output sum, output cout);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (b & cin) | (a & cin);
endmodule

module tb;
    reg a, b, cin;
    wire sum, cout;

    full_adder uut(.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

    integer i;

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t a=%b b=%b cin=%b sum=%b cout=%b", $time, a, b, cin, sum, cout);

        for (i = 0; i < 8; i = i + 1) begin
            {a, b, cin} = i[2:0];
            #10;
        end
        $finish;
    end
endmodule`
},

v_mux41: {
    language: 'verilog',
    code: `module mux4to1(input [3:0] d, input [1:0] s, output y);
    assign y = d[s];
endmodule

module tb;
    reg  [3:0] d;
    reg  [1:0] s;
    wire y;

    mux4to1 uut(.d(d), .s(s), .y(y));

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t d=%b s=%b y=%b", $time, d, s, y);

        d = 4'b1010;
        s = 2'b00; #10;
        s = 2'b01; #10;
        s = 2'b10; #10;
        s = 2'b11; #10;

        d = 4'b0110;
        s = 2'b00; #10;
        s = 2'b01; #10;
        s = 2'b10; #10;
        s = 2'b11; #10;
        $finish;
    end
endmodule`
},

v_dff: {
    language: 'verilog',
    code: `module dff(input clk, input rst, input d, output reg q);
    always @(posedge clk or posedge rst) begin
        if (rst)
            q <= 1'b0;
        else
            q <= d;
    end
endmodule

module tb;
    reg clk, rst, d;
    wire q;

    dff uut(.clk(clk), .rst(rst), .d(d), .q(q));

    always #5 clk = ~clk;

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t clk=%b rst=%b d=%b q=%b", $time, clk, rst, d, q);

        clk = 0; rst = 1; d = 0;
        #12 rst = 0;
        #10 d = 1;
        #10 d = 0;
        #10 d = 1;
        #10 rst = 1;
        #10 rst = 0; d = 1;
        #20 $finish;
    end
endmodule`
},

v_counter: {
    language: 'verilog',
    code: `module counter4(input clk, input rst, output reg [3:0] count);
    always @(posedge clk or posedge rst) begin
        if (rst)
            count <= 4'b0000;
        else
            count <= count + 1;
    end
endmodule

module tb;
    reg clk, rst;
    wire [3:0] count;

    counter4 uut(.clk(clk), .rst(rst), .count(count));

    always #5 clk = ~clk;

    initial begin
        $dumpfile("dump.vcd");
        $dumpvars(0, tb);
        $monitor("t=%0t rst=%b count=%d", $time, rst, count);

        clk = 0; rst = 1;
        #12 rst = 0;
        #180 $finish;
    end
endmodule`
},

/* ---------------------- MATLAB / OCTAVE ---------------------- */

m_matrix: {
    language: 'matlab',
    code: `% Matrix algebra and inversion
A = [4 -2 1; 3 6 -4; 2 1 8];
b = [12; -25; 32];

disp('Matrix A:');      disp(A);
disp('Determinant:');   disp(det(A));
disp('Inverse of A:');  disp(inv(A));

x = A \\ b;
disp('Solution of A*x = b:');
disp(x);

disp('Check A*x - b (should be ~0):');
disp(A*x - b);

figure;
bar(x);
title('Solution vector x');
xlabel('Index'); ylabel('Value');
grid on;`
},

m_sine: {
    language: 'matlab',
    code: `% Sine wave and harmonics
f  = 5;                    % fundamental frequency (Hz)
t  = 0:0.0005:1;           % time vector

x1 = sin(2*pi*f*t);
x3 = (1/3)*sin(2*pi*3*f*t);
x5 = (1/5)*sin(2*pi*5*f*t);
xs = x1 + x3 + x5;         % square-wave approximation

figure;
plot(t, x1, 'b', t, xs, 'r');
title('Fundamental and Sum of Harmonics');
xlabel('Time (s)'); ylabel('Amplitude');
legend('Fundamental', 'Fundamental + 3rd + 5th');
grid on;

disp('Done: sine wave and harmonics plotted');`
},

m_fft: {
    language: 'matlab',
    code: `% Fast Fourier Transform
fs = 1000;                 % sampling frequency (Hz)
t  = 0:1/fs:1-1/fs;
x  = sin(2*pi*50*t) + 0.5*sin(2*pi*120*t);

N  = length(x);
X  = fft(x);
mag = abs(X)/N*2;
f  = (0:N-1)*fs/N;

figure;
plot(t(1:200), x(1:200));
title('Time Domain Signal');
xlabel('Time (s)'); ylabel('Amplitude');
grid on;

figure;
plot(f(1:N/2), mag(1:N/2));
title('Magnitude Spectrum');
xlabel('Frequency (Hz)'); ylabel('|X(f)|');
grid on;

disp('Peaks expected at 50 Hz and 120 Hz');`
},

m_rc: {
    language: 'matlab',
    code: `% RC low-pass filter frequency response (Bode)
R  = 1e3;                  % 1 kOhm
C  = 1e-6;                 % 1 uF
fc = 1/(2*pi*R*C);
printf('Cut-off frequency fc = %.2f Hz\\n', fc);

f  = logspace(0, 5, 500);
w  = 2*pi*f;
H  = 1 ./ (1 + 1j*w*R*C);

mag_db = 20*log10(abs(H));
phase  = angle(H)*180/pi;

figure;
semilogx(f, mag_db);
title('RC Low-Pass: Magnitude');
xlabel('Frequency (Hz)'); ylabel('Magnitude (dB)');
grid on;

figure;
semilogx(f, phase);
title('RC Low-Pass: Phase');
xlabel('Frequency (Hz)'); ylabel('Phase (deg)');
grid on;`
},

m_step: {
    language: 'matlab',
    code: `% Step response of a second-order system (closed form)
wn   = 10;                 % natural frequency (rad/s)
zeta = [0.2 0.5 1.0];      % damping ratios
t    = 0:0.001:2;

figure;
hold on;
for k = 1:length(zeta)
    z = zeta(k);
    if z < 1
        wd = wn*sqrt(1 - z^2);
        y  = 1 - exp(-z*wn*t) .* (cos(wd*t) + (z*wn/wd)*sin(wd*t));
    else
        y  = 1 - (1 + wn*t) .* exp(-wn*t);
    end
    plot(t, y);
end
hold off;

title('Second-Order Step Response');
xlabel('Time (s)'); ylabel('Output');
legend('zeta = 0.2', 'zeta = 0.5', 'zeta = 1.0');
grid on;`
},

m_ode: {
    language: 'matlab',
    code: `% ODE: damped oscillator  x'' + 2*zeta*wn*x' + wn^2*x = 0
wn   = 5;
zeta = 0.15;

f  = @(x, t) [x(2); -2*zeta*wn*x(2) - wn^2*x(1)];
x0 = [1; 0];
t  = linspace(0, 5, 500);

sol = lsode(f, x0, t);

figure;
plot(t, sol(:,1), 'b', t, sol(:,2), 'r');
title('Damped Oscillator');
xlabel('Time (s)'); ylabel('State');
legend('Position', 'Velocity');
grid on;

figure;
plot(sol(:,1), sol(:,2));
title('Phase Portrait');
xlabel('Position'); ylabel('Velocity');
grid on;`
}

};
