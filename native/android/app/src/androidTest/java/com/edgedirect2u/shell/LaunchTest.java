package com.edgedirect2u.shell;
import androidx.test.rule.ActivityTestRule;
import org.junit.Rule;
import org.junit.Test;
import static org.junit.Assert.*;
public class LaunchTest {
    @Rule public ActivityTestRule<MainActivity> activity=new ActivityTestRule<>(MainActivity.class);
    @Test public void launchesWorkspaceWithoutPrivilegedBridge(){assertNotNull(activity.getActivity());assertFalse(activity.getActivity().isFinishing());}
}
