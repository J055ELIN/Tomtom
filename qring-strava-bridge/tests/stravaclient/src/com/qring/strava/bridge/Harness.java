package com.qring.strava.bridge;

import android.content.Context;
import java.util.concurrent.CountDownLatch;

public class Harness {
    public static void main(String[] args) throws Exception {
        Context ctx = new Context();
        StravaClient.base = "http://127.0.0.1:8099";
        StravaClient.saveCredentials(ctx, "12345", "sekret");

        final CountDownLatch l1 = new CountDownLatch(1);
        StravaClient.exchangeCode(ctx, "CODE-TEST", new StravaClient.Callback() {
            public void done(boolean ok, String msg) {
                System.out.println("LIAISON  ok=" + ok + " | " + msg);
                l1.countDown();
            }
        });
        l1.await();
        System.out.println("LIE=" + StravaClient.isLinked(ctx));

        String tcx = "<?xml version=\"1.0\"?><TrainingCenterDatabase><Activities/></TrainingCenterDatabase>";
        final CountDownLatch l2 = new CountDownLatch(1);
        StravaClient.upload(ctx, tcx.getBytes("UTF-8"), "QRingHR-test.tcx", new StravaClient.Callback() {
            public void done(boolean ok, String msg) {
                System.out.println("ENVOI    ok=" + ok + " | " + msg);
                l2.countDown();
            }
        });
        l2.await();
    }
}
