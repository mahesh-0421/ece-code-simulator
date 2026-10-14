module tb;

reg A;
reg B;
wire Y;

test uut(
    .A(A),
    .B(B),
    .Y(Y)
);

initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0,tb);

    A = 0; B = 0;
    #10 A = 0; B = 1;
    #10 A = 1; B = 0;
    #10 A = 1; B = 1;
    #10 $finish;
end

endmodule